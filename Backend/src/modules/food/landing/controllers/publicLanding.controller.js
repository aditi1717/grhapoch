import { getPublicGourmetRestaurants } from '../services/gourmet.service.js';
import { getLandingSettings } from '../services/landingSettings.service.js';
import { FoodHeroBanner } from '../models/heroBanner.model.js';
import { FoodUnder250Banner } from '../models/under250Banner.model.js';
import { FoodDiningBanner } from '../models/diningBanner.model.js';
import { FoodExploreIcon } from '../models/exploreIcon.model.js';
import { HomePromotionBanner } from '../models/homePromotionBanner.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { getPublicHomePromotionBanners } from '../services/homePromotionBanner.service.js';
import TopBanner from '../models/topBanner.model.js';
import AdBanner from '../models/adBanner.model.js';
import { isFeatureEnabled } from '../../admin/services/featureSettings.service.js';
import { sendResponse } from '../../../../utils/response.js';
import mongoose from 'mongoose';

/** Public hero banners for user home: active only, sorted, with linkedRestaurants populated for click-through */
export const getPublicHeroBannersController = async (req, res, next) => {
    try {
        const docs = await FoodHeroBanner.find({ isActive: true })
            .sort({ sortOrder: 1, createdAt: -1 })
            .populate({
                path: 'linkedRestaurantIds',
                select: '_id restaurantName slug area city rating cuisines profileImage pureVegRestaurant',
                model: 'FoodRestaurant'
            })
            .lean();
        const banners = (docs || []).map((b) => {
            const { linkedRestaurantIds, ...rest } = b;
            return {
                ...rest,
                linkedRestaurants: Array.isArray(linkedRestaurantIds) ? linkedRestaurantIds : [],
                imageUrl: b.imageUrl
            };
        });
        return sendResponse(res, 200, 'Hero banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicTopBannersController = async (req, res, next) => {
    try {
        const docs = await TopBanner.find({ isActive: true }).sort('order').lean();
        
        const isAdEnabled = await isFeatureEnabled('banner_advertising', false);
        let mappedAds = [];
        if (isAdEnabled) {
            const now = new Date();
            const activeAds = await AdBanner.find({
                status: 'approved',
                paymentStatus: 'paid',
                startDate: { $lte: now },
                endDate: { $gte: now }
            }).lean();

            mappedAds = activeAds.map(ad => ({
                _id: ad._id,
                image: ad.image,
                order: 999,
                isActive: true,
                isAd: true,
                targetType: ad.targetType,
                targetId: ad.targetId || (ad.targetType === 'restaurant' && ad.requesterType === 'FoodRestaurant' ? ad.requesterId.toString() : ''),
                targetUrl: ad.targetUrl,
                startDate: ad.startDate,
                endDate: ad.endDate,
                createdAt: ad.createdAt,
                updatedAt: ad.updatedAt
            }));
        }

        return sendResponse(res, 200, 'Top banners fetched', { banners: docs, ads: mappedAds });
    } catch (error) {
        next(error);
    }
};

export const getPublicUnder250BannersController = async (req, res, next) => {
    try {
        const docs = await FoodUnder250Banner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Under 250 banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicDiningBannersController = async (req, res, next) => {
    try {
        const docs = await FoodDiningBanner.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        return sendResponse(res, 200, 'Dining banners fetched', { banners: docs });
    } catch (error) {
        next(error);
    }
};

export const getPublicExploreIconsController = async (req, res, next) => {
    try {
        const docs = await FoodExploreIcon.find({ isActive: true }).sort({ sortOrder: 1, createdAt: -1 }).lean();
        const items = docs.map(({ targetPath, sortOrder, ...rest }) => ({ ...rest, link: targetPath, order: sortOrder }));
        return sendResponse(res, 200, 'Explore icons fetched', { items });
    } catch (error) {
        next(error);
    }
};

export const getPublicHomePromotionBannersController = async (req, res, next) => {
    try {
        const banners = await getPublicHomePromotionBanners();
        return sendResponse(res, 200, 'Home promotion banners fetched', { banners });
    } catch (error) {
        next(error);
    }
};

export const getPublicGourmetController = async (req, res, next) => {
    try {
        const docs = await getPublicGourmetRestaurants();
        const restaurants = (docs || [])
            .filter((d) => d.restaurant)
            .map((d) => ({
                ...(d.restaurant || {}),
                _id: d.restaurant?._id || d.restaurantId,
                priority: d.priority
            }));
        return sendResponse(res, 200, 'Gourmet restaurants fetched', { restaurants });
    } catch (error) {
        next(error);
    }
};

export const getPublicLandingSettingsController = async (req, res, next) => {
    try {
        const settings = await getLandingSettings();
        const ids = settings?.recommendedRestaurantIds || [];
        let recommendedRestaurants = [];
        if (Array.isArray(ids) && ids.length > 0) {
            const query = { _id: { $in: ids }, status: 'approved' };
            recommendedRestaurants = await FoodRestaurant.find(query)
                .select('restaurantName area city profileImage coverImages menuImages slug rating cuisines pureVegRestaurant')
                .lean();
        }
        const payload = {
            ...settings,
            recommendedRestaurantIds: undefined,
            recommendedRestaurants
        };
        return sendResponse(res, 200, 'Landing settings fetched', payload);
    } catch (error) {
        next(error);
    }
};
