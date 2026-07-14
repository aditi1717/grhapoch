import AdBanner from '../models/adBanner.model.js';
import { FoodBusinessSettings } from '../../admin/models/businessSettings.model.js';
import { isFeatureEnabled } from '../../admin/services/featureSettings.service.js';
import {
    createRazorpayOrder,
    getRazorpayKeyId,
    verifyPaymentSignature,
    initiateRazorpayRefund
} from '../../orders/helpers/razorpay.helper.js';
import { notifyAdminsSafely, notifyOwnerSafely } from '../../../../core/notifications/firebase.service.js';
import { ValidationError, AuthError } from '../../../../core/auth/errors.js';
import { sendResponse } from '../../../../utils/response.js';

export async function getAdPricing(req, res, next) {
    try {
        const settings = await FoodBusinessSettings.findOne().lean();
        const adDays = settings?.adBannerDays ?? 30;
        const adPrice = settings?.adBannerPrice ?? 2000;
        return sendResponse(res, 200, 'Ad pricing fetched successfully', {
            adDays,
            adPrice
        });
    } catch (error) {
        next(error);
    }
}

export async function requestAdCampaign(req, res, next) {
    try {
        const isEnabled = await isFeatureEnabled('banner_advertising', false);
        if (!isEnabled) {
            throw new ValidationError('Banner advertising functionality is currently disabled');
        }

        const { image, title, startDate, endDate, pricingType, targetType, targetId, targetUrl } = req.body;
        
        if (!image) throw new ValidationError('Banner image is required');
        if (!startDate || !endDate) throw new ValidationError('Campaign dates are required');
        if (!pricingType || !['daily', 'monthly'].includes(pricingType)) {
            throw new ValidationError('Invalid pricing selection');
        }

        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            throw new ValidationError('Invalid date formats');
        }

        if (start < new Date(new Date().setHours(0, 0, 0, 0))) {
            throw new ValidationError('Start date cannot be in the past');
        }
        if (end <= start) {
            throw new ValidationError('End date must be after start date');
        }

        // Calculate duration in days
        const diffTime = Math.abs(end - start);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        const settings = await FoodBusinessSettings.findOne().lean();
        const cost = settings?.adBannerPrice ?? 2000;

        const requesterId = req.user.userId;
        const requesterType = req.user.role === 'RESTAURANT' ? 'FoodRestaurant' : 'FoodUser';

        const receipt = `ad_${Date.now()}`;
        const amountPaise = Math.round(cost * 100);
        
        let rzOrder = { id: null };
        try {
            rzOrder = await createRazorpayOrder(amountPaise, 'INR', receipt);
        } catch (err) {
            console.error("Razorpay order creation failed, creating mock order in dev:", err.message);
            rzOrder = { id: `rzp_mock_${Date.now()}` };
        }

        const finalTargetId = (targetType === 'restaurant' && requesterType === 'FoodRestaurant')
            ? requesterId.toString()
            : (targetId || '');

        const adBanner = await AdBanner.create({
            requesterId,
            requesterType,
            image,
            title: title || '',
            startDate: start,
            endDate: end,
            pricingType,
            amountPaid: cost,
            paymentStatus: 'pending',
            razorpayOrderId: rzOrder.id,
            status: 'pending_approval',
            targetType: targetType || 'none',
            targetId: finalTargetId,
            targetUrl: targetUrl || ''
        });

        return sendResponse(res, 201, 'Ad campaign requested successfully', {
            adBannerId: adBanner._id,
            razorpayOrderId: rzOrder.id,
            amount: cost,
            razorpayKeyId: getRazorpayKeyId() || 'rzp_test_dummy'
        });
    } catch (error) {
        next(error);
    }
}

export async function verifyAdPayment(req, res, next) {
    try {
        const { adBannerId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

        if (!adBannerId) throw new ValidationError('adBannerId is required');

        const adBanner = await AdBanner.findById(adBannerId);
        if (!adBanner) {
            throw new ValidationError('Ad banner request not found');
        }

        // Verify signature if Razorpay is fully configured and it's not a mock dev order
        if (razorpayOrderId && !razorpayOrderId.startsWith('rzp_mock_')) {
            const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                throw new ValidationError('Invalid Razorpay signature verification failed');
            }
        }

        adBanner.paymentStatus = 'paid';
        adBanner.razorpayPaymentId = razorpayPaymentId || `pay_mock_${Date.now()}`;
        adBanner.razorpaySignature = razorpaySignature || 'sig_mock_dev';
        adBanner.status = 'pending_approval';
        await adBanner.save();

        // Notify active admins
        try {
            await notifyAdminsSafely({
                title: 'New Ad Request Pending Approval 📢',
                body: `A new banner ad campaign request of ₹${adBanner.amountPaid} has been submitted for approval.`,
                data: {
                    type: 'ad_banner_request',
                    adBannerId: adBanner._id.toString()
                }
            });
        } catch (e) {
            console.error("Failed to notify admins of new ad request:", e.message);
        }

        return sendResponse(res, 200, 'Payment verified successfully and request is pending approval', adBanner);
    } catch (error) {
        next(error);
    }
}

export async function cancelAdRequest(req, res, next) {
    try {
        const { id } = req.params;
        const adBanner = await AdBanner.findById(id);
        if (!adBanner) {
            throw new ValidationError('Ad banner request not found');
        }

        // Check ownership
        if (String(adBanner.requesterId) !== String(req.user.userId)) {
            throw new AuthError('Unauthorized to cancel this ad campaign');
        }

        if (adBanner.status !== 'pending_approval') {
            throw new ValidationError(`Cannot cancel campaign in ${adBanner.status} status`);
        }

        adBanner.status = 'cancelled';

        // Process refund if payment was already made
        if (adBanner.paymentStatus === 'paid' && adBanner.razorpayPaymentId && !adBanner.razorpayPaymentId.startsWith('pay_mock_')) {
            const refundRes = await initiateRazorpayRefund(adBanner.razorpayPaymentId, adBanner.amountPaid);
            if (refundRes.success) {
                adBanner.paymentStatus = 'refunded';
                adBanner.refundDetails = {
                    refundId: refundRes.refundId,
                    refundStatus: refundRes.status,
                    refundedAt: new Date()
                };
            } else {
                console.error("Refund failed on Razorpay, marking refund status as failed:", refundRes.error);
                adBanner.refundDetails = {
                    refundStatus: 'failed'
                };
            }
        } else if (adBanner.paymentStatus === 'paid') {
            // Mock refund for dev
            adBanner.paymentStatus = 'refunded';
            adBanner.refundDetails = {
                refundId: `ref_mock_${Date.now()}`,
                refundStatus: 'processed',
                refundedAt: new Date()
            };
        }

        await adBanner.save();
        return sendResponse(res, 200, 'Ad campaign request cancelled and refund initiated successfully', adBanner);
    } catch (error) {
        next(error);
    }
}

export async function getMyAdCampaigns(req, res, next) {
    try {
        const docs = await AdBanner.find({ requesterId: req.user.userId }).sort({ createdAt: -1 }).lean();
        return sendResponse(res, 200, 'My campaigns fetched successfully', { campaigns: docs });
    } catch (error) {
        next(error);
    }
}

export async function adminListAdRequests(req, res, next) {
    try {
        const docs = await AdBanner.find({ paymentStatus: { $ne: 'pending' } })
            .populate({
                path: 'requesterId',
                select: 'name restaurantName email phone ownerName ownerEmail ownerPhone primaryContactNumber role'
            })
            .sort({ createdAt: -1 })
            .lean();

        const requests = docs.map(doc => {
            const requester = doc.requesterId || {};
            const requesterName = requester.restaurantName || requester.ownerName || requester.name || 'Unknown';
            const requesterContact = requester.primaryContactNumber || requester.ownerPhone || requester.phone || '';
            const requesterEmail = requester.ownerEmail || requester.email || '';
            
            return {
                ...doc,
                requesterName,
                requesterContact,
                requesterEmail
            };
        });

        return sendResponse(res, 200, 'Admin ad requests listed successfully', { requests });
    } catch (error) {
        next(error);
    }
}

export async function adminApproveAdRequest(req, res, next) {
    try {
        const { id } = req.params;
        const adBanner = await AdBanner.findById(id);
        if (!adBanner) {
            throw new ValidationError('Ad banner request not found');
        }

        if (adBanner.status !== 'pending_approval') {
            throw new ValidationError(`Cannot approve request in ${adBanner.status} status`);
        }

        const durationMs = adBanner.endDate.getTime() - adBanner.startDate.getTime();
        const now = new Date();
        adBanner.startDate = now;
        adBanner.endDate = new Date(now.getTime() + durationMs);
        adBanner.status = 'approved';
        await adBanner.save();

        // Notify owner
        const ownerType = adBanner.requesterType === 'FoodRestaurant' ? 'RESTAURANT' : 'USER';
        try {
            await notifyOwnerSafely(
                { ownerType, ownerId: adBanner.requesterId.toString() },
                {
                    title: 'Ad Banner Approved! 🎉',
                    body: `Your banner advertisement starting on ${new Date(adBanner.startDate).toLocaleDateString()} was approved by the admin.`,
                    data: {
                        type: 'ad_banner_approval',
                        adBannerId: adBanner._id.toString()
                    }
                }
            );
        } catch (e) {
            console.error("Failed to notify user of ad approval:", e.message);
        }

        return sendResponse(res, 200, 'Ad request approved successfully', adBanner);
    } catch (error) {
        next(error);
    }
}

export async function adminRejectAdRequest(req, res, next) {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        if (!reason) throw new ValidationError('Rejection reason is required');

        const adBanner = await AdBanner.findById(id);
        if (!adBanner) {
            throw new ValidationError('Ad banner request not found');
        }

        if (adBanner.status !== 'pending_approval') {
            throw new ValidationError(`Cannot reject request in ${adBanner.status} status`);
        }

        adBanner.status = 'rejected';
        adBanner.rejectionReason = reason;

        // Process refund if payment was already made
        if (adBanner.paymentStatus === 'paid' && adBanner.razorpayPaymentId && !adBanner.razorpayPaymentId.startsWith('pay_mock_')) {
            const refundRes = await initiateRazorpayRefund(adBanner.razorpayPaymentId, adBanner.amountPaid);
            if (refundRes.success) {
                adBanner.paymentStatus = 'refunded';
                adBanner.refundDetails = {
                    refundId: refundRes.refundId,
                    refundStatus: refundRes.status,
                    refundedAt: new Date()
                };
            } else {
                console.error("Refund failed on Razorpay, marking refund status as failed:", refundRes.error);
                adBanner.refundDetails = {
                    refundStatus: 'failed'
                };
            }
        } else if (adBanner.paymentStatus === 'paid') {
            // Mock refund for dev
            adBanner.paymentStatus = 'refunded';
            adBanner.refundDetails = {
                refundId: `ref_mock_${Date.now()}`,
                refundStatus: 'processed',
                refundedAt: new Date()
            };
        }

        await adBanner.save();

        // Notify owner
        const ownerType = adBanner.requesterType === 'FoodRestaurant' ? 'RESTAURANT' : 'USER';
        try {
            await notifyOwnerSafely(
                { ownerType, ownerId: adBanner.requesterId.toString() },
                {
                    title: 'Ad Banner Request Update 📢',
                    body: `Your banner ad request was rejected. Reason: ${reason}. A full refund has been initiated.`,
                    data: {
                        type: 'ad_banner_rejection',
                        adBannerId: adBanner._id.toString()
                    }
                }
            );
        } catch (e) {
            console.error("Failed to notify user of ad rejection:", e.message);
        }

        return sendResponse(res, 200, 'Ad request rejected and refund initiated successfully', adBanner);
    } catch (error) {
        next(error);
    }
}
