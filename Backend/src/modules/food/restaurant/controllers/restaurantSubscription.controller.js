import mongoose from 'mongoose';
import * as subService from '../services/restaurantSubscription.service.js';
import * as planService from '../services/subscriptionPlan.service.js';

export async function getSubscriptionPlansController(req, res, next) {
    try {
        const plans = await planService.getSubscriptionPlans({ isActive: true });
        res.status(200).json({ success: true, message: 'Subscription plans fetched successfully', data: { plans } });
    } catch (error) {
        next(error);
    }
}

export async function getCurrentSubscriptionController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const subscription = await subService.getCurrentSubscription(restaurantId);
        res.status(200).json({ success: true, message: 'Current subscription fetched successfully', data: { subscription } });
    } catch (error) {
        next(error);
    }
}

export async function subscribeToPlanController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const { planId } = req.body || {};
        const result = await subService.subscribeToPlan(restaurantId, planId);
        res.status(200).json({ success: true, message: 'Subscription request processed successfully', data: result });
    } catch (error) {
        next(error);
    }
}

export async function verifySubscriptionPaymentController(req, res, next) {
    try {
        const restaurantId = req.user?.userId;
        const subscription = await subService.verifySubscriptionPayment(restaurantId, req.body || {});
        res.status(200).json({ success: true, message: 'Subscription payment verified and activated successfully', data: { subscription } });
    } catch (error) {
        next(error);
    }
}
