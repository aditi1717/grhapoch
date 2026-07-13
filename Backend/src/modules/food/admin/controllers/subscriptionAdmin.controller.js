import mongoose from 'mongoose';
import * as planService from '../../restaurant/services/subscriptionPlan.service.js';
import { FoodRestaurantSubscription } from '../../restaurant/models/restaurantSubscription.model.js';

export async function createSubscriptionPlanController(req, res, next) {
    try {
        const plan = await planService.createSubscriptionPlan(req.body || {});
        res.status(201).json({ success: true, message: 'Subscription plan created successfully', data: { plan } });
    } catch (error) {
        next(error);
    }
}

export async function getSubscriptionPlansController(req, res, next) {
    try {
        const plans = await planService.getSubscriptionPlans(req.query || {});
        res.status(200).json({ success: true, message: 'Subscription plans fetched successfully', data: { plans } });
    } catch (error) {
        next(error);
    }
}

export async function getSubscriptionPlanByIdController(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subscription plan ID' });
        }
        const plan = await planService.getSubscriptionPlanById(id);
        res.status(200).json({ success: true, message: 'Subscription plan fetched successfully', data: { plan } });
    } catch (error) {
        next(error);
    }
}

export async function updateSubscriptionPlanController(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subscription plan ID' });
        }
        const plan = await planService.updateSubscriptionPlan(id, req.body || {});
        res.status(200).json({ success: true, message: 'Subscription plan updated successfully', data: { plan } });
    } catch (error) {
        next(error);
    }
}

export async function deleteSubscriptionPlanController(req, res, next) {
    try {
        const { id } = req.params;
        if (!id || !mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, message: 'Invalid subscription plan ID' });
        }
        const result = await planService.deleteSubscriptionPlan(id);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
}

export async function getRestaurantSubscriptionsController(req, res, next) {
    try {
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 100);
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.status) {
            filter.status = String(req.query.status);
        }
        if (req.query.restaurantId && mongoose.Types.ObjectId.isValid(req.query.restaurantId)) {
            filter.restaurantId = new mongoose.Types.ObjectId(String(req.query.restaurantId));
        }

        const [subscriptions, total] = await Promise.all([
            FoodRestaurantSubscription.find(filter)
                .populate('restaurantId', 'restaurantName ownerName ownerEmail ownerPhone')
                .populate('planId')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            FoodRestaurantSubscription.countDocuments(filter)
        ]);

        res.status(200).json({
            success: true,
            message: 'Restaurant subscriptions fetched successfully',
            data: {
                subscriptions,
                pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 }
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function getSubscriptionSettingsController(req, res, next) {
    try {
        const { FoodBusinessSettings } = await import('../models/businessSettings.model.js');
        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = await FoodBusinessSettings.create({
                companyName: 'Grhapoch',
                email: 'admin@grhapoch.com'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Subscription settings fetched successfully',
            data: {
                daysBefore: settings.subscriptionExpiryAlert?.daysBefore || 3,
                messageTemplate: settings.subscriptionExpiryAlert?.messageTemplate || "Your subscription plan '{planName}' is expiring in {daysRemaining} days. Please renew to keep enjoying commission-free orders."
            }
        });
    } catch (error) {
        next(error);
    }
}

export async function updateSubscriptionSettingsController(req, res, next) {
    try {
        const { FoodBusinessSettings } = await import('../models/businessSettings.model.js');
        const { daysBefore, messageTemplate } = req.body || {};
        
        if (daysBefore !== undefined && (isNaN(Number(daysBefore)) || Number(daysBefore) < 1)) {
            return res.status(400).json({ success: false, message: 'Warning days must be at least 1' });
        }
        if (messageTemplate !== undefined && !String(messageTemplate).trim()) {
            return res.status(400).json({ success: false, message: 'Message template cannot be empty' });
        }

        let settings = await FoodBusinessSettings.findOne();
        if (!settings) {
            settings = new FoodBusinessSettings({
                companyName: 'Grhapoch',
                email: 'admin@grhapoch.com'
            });
        }

        settings.subscriptionExpiryAlert = {
            daysBefore: daysBefore !== undefined ? Number(daysBefore) : (settings.subscriptionExpiryAlert?.daysBefore || 3),
            messageTemplate: messageTemplate !== undefined ? String(messageTemplate).trim() : (settings.subscriptionExpiryAlert?.messageTemplate || "Your subscription plan '{planName}' is expiring in {daysRemaining} days. Please renew to keep enjoying commission-free orders.")
        };

        await settings.save();
        res.status(200).json({ 
            success: true, 
            message: 'Subscription settings updated successfully', 
            data: {
                daysBefore: settings.subscriptionExpiryAlert.daysBefore,
                messageTemplate: settings.subscriptionExpiryAlert.messageTemplate
            }
        });
    } catch (error) {
        next(error);
    }
}
