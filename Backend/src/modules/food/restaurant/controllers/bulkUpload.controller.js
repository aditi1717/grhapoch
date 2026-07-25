import { sendResponse, sendError } from '../../../../utils/response.js';
import { generateBulkMenuTemplate, processBulkMenuUpload } from '../services/bulkUpload.service.js';
import { ValidationError } from '../../../../core/auth/errors.js';
import fs from 'fs';

export const downloadBulkMenuTemplateController = async (req, res, next) => {
    try {
        const workbook = await generateBulkMenuTemplate();
        
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=Bulk_Menu_Template.xlsx'
        );

        return workbook.xlsx.write(res).then(() => {
            res.status(200).end();
        });
    } catch (error) {
        next(error);
    }
};

export const uploadBulkMenuController = async (req, res, next) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'Please upload an Excel file (.xlsx)');
        }

        const restaurantId = req.user?.userId || req.user?.id || req.user?._id;
        if (!restaurantId) {
            return sendError(res, 400, 'Restaurant ID missing from session');
        }

        const results = await processBulkMenuUpload(restaurantId, req.file.buffer);

        return sendResponse(res, 200, 'Bulk upload completed successfully', results);
    } catch (error) {
        if (error instanceof ValidationError || error.name === 'ValidationError') {
            return sendError(res, 400, error.message);
        }
        console.error('Bulk menu upload error:', error);
        return sendError(res, 400, error.message || 'Failed to process bulk upload file');
    }
};

export const uploadAdminBulkMenuController = async (req, res, next) => {
    try {
        if (!req.file) {
            return sendError(res, 400, 'Please upload an Excel file (.xlsx)');
        }

        const restaurantId = req.body?.restaurantId;
        if (!restaurantId) {
            return sendError(res, 400, 'restaurantId is required');
        }

        const results = await processBulkMenuUpload(restaurantId, req.file.buffer, {
            approvalStatus: 'approved',
        });

        return sendResponse(res, 200, 'Bulk upload completed successfully', results);
    } catch (error) {
        if (error instanceof ValidationError || error.name === 'ValidationError') {
            return sendError(res, 400, error.message);
        }
        console.error('Admin bulk menu upload error:', error);
        return sendError(res, 400, error.message || 'Failed to process bulk upload file');
    }
};
