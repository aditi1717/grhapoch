import express from 'express';
import { authMiddleware } from '../../../../core/auth/auth.middleware.js';
import { requireRoles } from '../../../../core/roles/role.middleware.js';
import {
    getAdPricing,
    requestAdCampaign,
    verifyAdPayment,
    cancelAdRequest,
    getMyAdCampaigns,
    adminListAdRequests,
    adminApproveAdRequest,
    adminRejectAdRequest
} from '../controllers/adBanner.controller.js';

const router = express.Router();

// Public Pricing endpoint (accessible by users and restaurants)
router.get('/pricing', getAdPricing);

// Requester Endpoints (requires USER or RESTAURANT role)
router.post('/request', authMiddleware, requireRoles('USER', 'RESTAURANT'), requestAdCampaign);
router.post('/verify', authMiddleware, requireRoles('USER', 'RESTAURANT'), verifyAdPayment);
router.post('/:id/cancel', authMiddleware, requireRoles('USER', 'RESTAURANT'), cancelAdRequest);
router.get('/my-ads', authMiddleware, requireRoles('USER', 'RESTAURANT'), getMyAdCampaigns);

// Admin Endpoints (requires ADMIN role)
router.get('/admin/requests', authMiddleware, requireRoles('ADMIN'), adminListAdRequests);
router.patch('/admin/:id/approve', authMiddleware, requireRoles('ADMIN'), adminApproveAdRequest);
router.patch('/admin/:id/reject', authMiddleware, requireRoles('ADMIN'), adminRejectAdRequest);

export default router;
