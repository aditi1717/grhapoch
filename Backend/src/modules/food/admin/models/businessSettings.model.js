import mongoose from 'mongoose';

const businessSettingsSchema = new mongoose.Schema(
    {
        companyName: { type: String, required: true, default: 'Grhapoch' },
        email: { type: String, required: true, default: 'admin@grhapoch.com' },
        phone: {
            countryCode: { type: String, default: '+91' },
            number: { type: String, default: '' }
        },
        address: { type: String, default: '' },
        state: { type: String, default: '' },
        pincode: { type: String, default: '' },
        region: { type: String, default: 'India' },
        logo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        favicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        restaurantLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        restaurantFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        deliveryLogo: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        deliveryFavicon: {
            url: { type: String, default: '' },
            publicId: { type: String, default: '' }
        },
        powerScanning: {
            user: {
                themeColor: { type: String, default: '#FA0272' },
                fontFamily: { type: String, default: 'Poppins' }
            },
            restaurant: {
                themeColor: { type: String, default: '#2563EB' },
                fontFamily: { type: String, default: 'Poppins' }
            },
            delivery: {
                themeColor: { type: String, default: '#00B761' },
                fontFamily: { type: String, default: 'Poppins' }
            }
        },
        orderAcceptanceTimeMinutes: { type: Number, default: 4, min: 1, max: 20 },
        subscriptionExpiryAlert: {
            daysBefore: { type: Number, default: 3, min: 1 },
            messageTemplate: { type: String, default: "Your subscription plan '{planName}' is expiring in {daysRemaining} days. Please renew to keep enjoying commission-free orders." }
        },
        adBannerDays: { type: Number, default: 30 },
        adBannerPrice: { type: Number, default: 2000 },
        adBannerDailyPrice: { type: Number, default: 100 },
        adBannerMonthlyPrice: { type: Number, default: 2500 },
        /**
         * Delivery Boy Dispatch Radius (KM).
         * From the restaurant's location, delivery partners within this radius
         * are assigned/called for orders. Applied as deliveryRadius on new delivery partners.
         */
        deliveryBoyRadius: { type: Number, default: 10, min: 0.1 },
        /**
         * User Visibility Radius (KM).
         * How far from a restaurant a user can be and still see and order from it.
         * Applied as serviceRadius on new restaurants and used as the geo search cap.
         */
        userVisibilityRadius: { type: Number, default: 10, min: 0.1 }
    },
    { timestamps: true }
);

export const FoodBusinessSettings = mongoose.model('FoodBusinessSettings', businessSettingsSchema);
