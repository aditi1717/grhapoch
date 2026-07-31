import axios from 'axios';
import { config } from '../../config/env.js';

class PRPSMSService {
  constructor() {
    this.apiKey = config.prpSmsApiKey || process.env.PRPSMS_API_KEY;
    this.senderId = config.prpSmsSenderId || process.env.PRPSMS_SENDER_ID || 'VRUSOY';
    this.templateName = config.prpSmsOtpTemplate || process.env.PRPSMS_OTP_TEMPLATE || 'Temp 4';
    this.baseUrl = 'https://api.bulksmsadmin.com/BulkSMSapi/keyApiSendSMS/SendSmsTemplateName';
  }

  normalizePhoneNumber(phone) {
    // Remove non-digits
    const digits = phone.replace(/[^0-9]/g, '');
    // For PRPSMS, assume it wants 10 digits or digits with 91 but no special characters
    // Most Indian gateways expect 10 digits or 12 digits (with 91)
    if (digits.length === 10) return digits;
    if (digits.length === 12 && digits.startsWith('91')) return digits;
    return digits.slice(-10); // Default to last 10 digits
  }

  async sendOTP(phone, otp) {
    try {
      const apiKey = this.apiKey || config.prpSmsApiKey || process.env.PRPSMS_API_KEY;
      const senderId = this.senderId || config.prpSmsSenderId || process.env.PRPSMS_SENDER_ID || 'VRUSOY';
      const templateName = this.templateName || config.prpSmsOtpTemplate || process.env.PRPSMS_OTP_TEMPLATE || 'Temp 4';

      if (!apiKey) {
        console.warn('⚠️ [PRPSMS] Missing API Key. SMS NOT SENT.');
        return { success: false, error: 'Missing API Key' };
      }

      const mobileNo = this.normalizePhoneNumber(phone);

      const payload = {
        sender: senderId,
        templateName: templateName,
        smsReciever: [
          {
            mobileNo: mobileNo,
            templateParams: String(otp)
          }
        ]
      };

      console.log(`📨 [PRPSMS] Sending OTP to ${mobileNo}...`);

      const response = await axios.post(this.baseUrl, payload, {
        headers: {
          'apikey': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      });

      console.log('📨 [PRPSMS] Response:', response.data);

      // Successful responses vary by provider, checking status or a specific field
      if (response.status === 200 || response.data?.status === 'success') {
        console.log('✅ OTP Sent Successfully via PRPSMS');
        return { success: true, data: response.data };
      }

      return { success: false, error: 'PRPSMS failure', detail: response.data };

    } catch (error) {
      console.error('❌ PRPSMS Service Error:', error.response?.data || error.message);
      return { success: false, error: error.message };
    }
  }

  // Generic SMS fallback (PRPSMS uses templates for everything usually)
  async sendSMS(phone, message) {
     console.warn('⚠️ [PRPSMS] sendSMS called, but PRPSMS is template-based. Using default OTP template.');
     return this.sendOTP(phone, message);
  }
}

export default new PRPSMSService();
