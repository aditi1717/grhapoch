import { FoodZone } from '../../admin/models/zone.model.js';
import { FoodRestaurant } from '../../restaurant/models/restaurant.model.js';
import { getRedisClient } from '../../../../config/redis.js';

const ACTIVE_ZONES_CACHE_KEY = 'zones:active:list:v1';
const ACTIVE_ZONES_CACHE_TTL_SECONDS = 120;
const ZONE_DETECT_CACHE_TTL_SECONDS = 180;

const toFinite = (v) => {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
};

const roundCoordinate = (value, precision = 3) => {
    const numeric = toFinite(value);
    if (numeric === null) return null;
    return Number(numeric.toFixed(precision));
};

const buildZoneDetectCacheKey = (lat, lng) => {
    const roundedLat = roundCoordinate(lat, 3);
    const roundedLng = roundCoordinate(lng, 3);
    if (roundedLat === null || roundedLng === null) return null;
    return `zones:detect:${roundedLat}:${roundedLng}`;
};

const getCachedJson = async (key) => {
    const redis = getRedisClient();
    if (!redis || !redis.isReady || !key) return null;

    const raw = await redis.get(key);
    if (!raw) return null;

    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
};

const setCachedJson = async (key, value, ttlSeconds) => {
    const redis = getRedisClient();
    if (!redis || !redis.isReady || !key) return;
    await redis.set(key, JSON.stringify(value), { EX: ttlSeconds });
};

export const invalidateActiveZonesCache = async () => {
    const redis = getRedisClient();
    if (!redis || !redis.isReady) return;
    await redis.del(ACTIVE_ZONES_CACHE_KEY);
};

const getActiveZones = async () => {
    const cached = await getCachedJson(ACTIVE_ZONES_CACHE_KEY);
    if (Array.isArray(cached)) return cached;

    const zones = await FoodZone.find({ isActive: true }).lean();
    await setCachedJson(ACTIVE_ZONES_CACHE_KEY, zones, ACTIVE_ZONES_CACHE_TTL_SECONDS);
    return zones;
};

// Ray-casting point-in-polygon for lat/lng polygons.
const isPointInPolygon = (lat, lng, polygon) => {
    if (!Array.isArray(polygon) || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].longitude;
        const yi = polygon[i].latitude;
        const xj = polygon[j].longitude;
        const yj = polygon[j].latitude;
        const intersect =
            yi > lat !== yj > lat &&
            lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

/** GET /zones/detect?lat=..&lng=.. */
export const detectZonePublicController = async (req, res, next) => {
    try {
        const lat = toFinite(req.query.lat);
        const lng = toFinite(req.query.lng);
        if (lat === null || lng === null) {
            return res.status(400).json({ success: false, message: 'lat and lng are required' });
        }

        const cacheKey = buildZoneDetectCacheKey(lat, lng);
        const cached = await getCachedJson(cacheKey);
        if (cached) {
            return res.status(200).json(cached);
        }

        // Geospatial search: Find first restaurant that covers user location coordinates
        const matchedRestaurants = await FoodRestaurant.aggregate([
            {
                $geoNear: {
                    near: { type: 'Point', coordinates: [lng, lat] },
                    distanceField: 'distanceMeters',
                    spherical: true,
                    query: { status: 'approved', isAcceptingOrders: true }
                }
            },
            {
                $match: {
                    $expr: {
                        $lte: [
                            "$distanceMeters",
                            { $multiply: [ { $ifNull: ["$serviceRadius", 10] }, 1000 ] }
                        ]
                    }
                }
            },
            { $limit: 1 }
        ]);

        if (matchedRestaurants.length > 0) {
            const restaurant = matchedRestaurants[0];
            const mockZone = {
                _id: '507f1f77bcf86cd799439011',
                name: 'Radius Service',
                zoneName: 'Radius Service',
                country: 'India',
                serviceLocation: restaurant.city || 'Indore',
                unit: 'kilometer',
                coordinates: [],
                isActive: true
            };
            const response = {
                success: true,
                message: 'Zone detected',
                data: { status: 'IN_SERVICE', zoneId: mockZone._id, zone: mockZone }
            };
            await setCachedJson(cacheKey, response, ZONE_DETECT_CACHE_TTL_SECONDS);
            return res.status(200).json(response);
        }

        const response = {
            success: true,
            message: 'Out of service',
            data: { status: 'OUT_OF_SERVICE', zoneId: null, zone: null }
        };
        await setCachedJson(cacheKey, response, ZONE_DETECT_CACHE_TTL_SECONDS);
        return res.status(200).json(response);
    } catch (error) {
        next(error);
    }
};

/** GET /zones/public - list active zones for onboarding/selects */
export const listZonesPublicController = async (_req, res, next) => {
    try {
        const mockZone = {
            _id: '507f1f77bcf86cd799439011',
            name: 'Radius Service',
            zoneName: 'Radius Service',
            serviceLocation: 'Indore',
            country: 'India',
            unit: 'kilometer',
            isActive: true,
            coordinates: [],
            createdAt: new Date()
        };

        return res.status(200).json({
            success: true,
            message: 'Zones fetched successfully',
            data: { zones: [mockZone] }
        });
    } catch (error) {
        next(error);
    }
};

/** GET /zones/nearby - list zones for hotspot/nearby visualization */
export const listZonesNearbyPublicController = async (_req, res, next) => {
    try {
        const mockZone = {
            _id: '507f1f77bcf86cd799439011',
            name: 'Radius Service',
            zoneName: 'Radius Service',
            serviceLocation: 'Indore',
            country: 'India',
            unit: 'kilometer',
            isActive: true,
            coordinates: [],
            createdAt: new Date()
        };

        return res.status(200).json({
            success: true,
            message: 'Nearby zones fetched',
            data: { zones: [mockZone] }
        });
    } catch (error) {
        next(error);
    }
};
