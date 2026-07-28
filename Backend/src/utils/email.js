import nodemailer from 'nodemailer';
import { config } from '../config/env.js';
import { logger } from './logger.js';

let transporter = null;

function getTransporter() {
    if (transporter) return transporter;
    const { emailHost, emailPort, emailUser, emailPass } = config;
    if (!emailHost || !emailUser || !emailPass) {
        logger.warn('Email not configured: EMAIL_HOST, EMAIL_USER, EMAIL_PASS required');
        return null;
    }
    transporter = nodemailer.createTransport({
        host: emailHost,
        port: emailPort || 587,
        secure: emailPort === 465,
        auth: {
            user: emailUser,
            pass: emailPass
        }
    });
    return transporter;
}

/**
 * Send OTP email for admin forgot password.
 * @param {string} to - Recipient email
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendAdminResetOtpEmail(to, otp) {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Admin OTP email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const subject = 'Your password reset code – Grhapoch Admin';
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Password reset code</h2>
  <p>Use the code below to reset your admin password. It is valid for 10 minutes.</p>
  <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #f5f5f5; padding: 12px 16px; border-radius: 8px;">${otp}</p>
  <p style="color: #666; font-size: 14px;">If you did not request this, you can ignore this email.</p>
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Grhapoch Admin</p>
</body>
</html>`;
    const text = `Your password reset code is: ${otp}. It is valid for 10 minutes. If you did not request this, ignore this email.`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Grhapoch <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Admin reset OTP email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send admin OTP email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send onboarding status email for restaurant owners.
 * @param {string} to - Recipient email
 * @param {string} restaurantName - Restaurant name
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} [reason=""] - Optional rejection reason
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendRestaurantOnboardingStatusEmail(to, restaurantName, status, reason = '') {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Restaurant onboarding status email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const isApproved = status === 'approved';
    const subject = isApproved 
        ? `Congratulations! ${restaurantName} Onboarding Approved` 
        : `${restaurantName} Onboarding Update`;
        
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Onboarding Application Status Update</h2>
  <p>Hello,</p>
  <p>Your restaurant <strong>${restaurantName}</strong> has been <strong>${status}</strong> by our administrators.</p>
  ${isApproved 
    ? `<p style="color: #2e7d32; font-weight: bold;">You can now log in and start receiving orders!</p>` 
    : `<p style="color: #c62828; font-weight: bold;">Unfortunately, your request could not be approved at this time.</p>
       ${reason ? `<p><strong>Reason for rejection:</strong> ${reason}</p>` : ''}`
  }
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Grhapoch Team</p>
</body>
</html>`;
    const text = `Hello, your restaurant onboarding status for ${restaurantName} is: ${status}. ${!isApproved && reason ? `Reason: ${reason}` : ''}`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Grhapoch <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Restaurant onboarding status email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send restaurant status email to ${to}:`, err.message);
        return false;
    }
}

/**
 * Send onboarding status email for delivery partners.
 * @param {string} to - Recipient email
 * @param {string} partnerName - Partner name
 * @param {string} status - 'approved' or 'rejected'
 * @param {string} [reason=""] - Optional rejection reason
 * @returns {Promise<boolean>} true if sent, false if skipped/failed
 */
export async function sendDeliveryPartnerOnboardingStatusEmail(to, partnerName, status, reason = '') {
    const trans = getTransporter();
    if (!trans) {
        logger.warn('Delivery partner onboarding status email skipped: SMTP not configured');
        return false;
    }
    const from = config.emailFrom || config.emailUser;
    const isApproved = status === 'approved';
    const subject = isApproved 
        ? `Welcome to the Team! Onboarding Approved` 
        : `Delivery Partner Application Update`;
        
    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 480px; margin: 0 auto; padding: 20px;">
  <h2 style="color: #111;">Onboarding Application Status Update</h2>
  <p>Hello ${partnerName},</p>
  <p>Your application to join as a delivery partner has been <strong>${status}</strong>.</p>
  ${isApproved 
    ? `<p style="color: #2e7d32; font-weight: bold;">You can now log in to the delivery partner app and start earning!</p>` 
    : `<p style="color: #c62828; font-weight: bold;">Unfortunately, your request could not be approved at this time.</p>
       ${reason ? `<p><strong>Reason for rejection:</strong> ${reason}</p>` : ''}`
  }
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  <p style="color: #999; font-size: 12px;">Grhapoch Team</p>
</body>
</html>`;
    const text = `Hello ${partnerName}, your delivery partner onboarding status is: ${status}. ${!isApproved && reason ? `Reason: ${reason}` : ''}`;

    try {
        await trans.sendMail({
            from: typeof from === 'string' && from.includes('<') ? from : `Grhapoch <${from}>`,
            to,
            subject,
            text,
            html
        });
        logger.info(`Delivery partner onboarding status email sent to ${to}`);
        return true;
    } catch (err) {
        logger.error(`Failed to send delivery partner status email to ${to}:`, err.message);
        return false;
    }
}

