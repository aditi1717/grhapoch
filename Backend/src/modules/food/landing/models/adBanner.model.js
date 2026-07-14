import mongoose from 'mongoose';

const adBannerSchema = new mongoose.Schema(
    {
        requesterId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'requesterType'
        },
        requesterType: {
            type: String,
            required: true,
            enum: ['FoodUser', 'FoodRestaurant']
        },
        image: {
            type: String,
            required: true
        },
        title: {
            type: String,
            default: ''
        },
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        pricingType: {
            type: String,
            required: true,
            enum: ['daily', 'monthly']
        },
        amountPaid: {
            type: Number,
            required: true
        },
        paymentStatus: {
            type: String,
            required: true,
            enum: ['pending', 'paid', 'failed', 'refunded'],
            default: 'pending'
        },
        razorpayOrderId: {
            type: String,
            default: null
        },
        razorpayPaymentId: {
            type: String,
            default: null
        },
        razorpaySignature: {
            type: String,
            default: null
        },
        refundDetails: {
            refundId: { type: String, default: null },
            refundStatus: { type: String, default: null },
            refundedAt: { type: Date, default: null }
        },
        status: {
            type: String,
            required: true,
            enum: ['pending_approval', 'approved', 'rejected', 'cancelled', 'expired'],
            default: 'pending_approval'
        },
        rejectionReason: {
            type: String,
            default: ''
        },
        targetType: {
            type: String,
            required: true,
            enum: ['restaurant', 'product', 'url', 'none'],
            default: 'none'
        },
        targetId: {
            type: String,
            default: ''
        },
        targetUrl: {
            type: String,
            default: ''
        }
    },
    {
        timestamps: true
    }
);

// Indexes for active campaign retrieval
adBannerSchema.index({ status: 1, paymentStatus: 1, startDate: 1, endDate: 1 });
adBannerSchema.index({ requesterId: 1, requesterType: 1 });

const AdBanner = mongoose.model('AdBanner', adBannerSchema);

export default AdBanner;
