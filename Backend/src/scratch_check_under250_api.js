import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import { listApprovedRestaurants } from './modules/food/restaurant/services/restaurant.service.js';
import { listPublicFoods } from './modules/food/restaurant/services/publicFoods.service.js';

const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://grhapoch_db_user:cgoxdBiIThjVS9ca@grhapoch.tbq66wh.mongodb.net/Grhapoch";

const VIJAY_NAGAR_LAT = 22.7533;
const VIJAY_NAGAR_LNG = 75.8937;

async function testUnder250BackendCalls() {
    try {
        console.log("Connecting to MongoDB...");
        await mongoose.connect(MONGODB_URI);
        console.log("Connected successfully!\n");

        console.log("1. CALLING listApprovedRestaurants({ lat: 22.7533, lng: 75.8937, limit: 1000 })...");
        const restResult = await listApprovedRestaurants({
            lat: VIJAY_NAGAR_LAT,
            lng: VIJAY_NAGAR_LNG,
            limit: 1000
        });

        const returnedRestaurants = restResult?.restaurants || [];
        console.log(`-> Returned ${returnedRestaurants.length} restaurant(s) from listApprovedRestaurants:`);
        returnedRestaurants.forEach(r => {
            console.log(`   - Name: "${r.restaurantName || r.name}" | ID: ${r._id || r.id} | DistanceInKm: ${r.distanceInKm}`);
        });

        console.log("\n2. CALLING listPublicFoods({ lat: 22.7533, lng: 75.8937, promo: 'switch99', limit: 1000 })...");
        const foodResult = await listPublicFoods({
            lat: VIJAY_NAGAR_LAT,
            lng: VIJAY_NAGAR_LNG,
            promo: 'switch99',
            limit: 1000
        });

        const returnedFoods = foodResult?.foods || [];
        console.log(`-> Returned ${returnedFoods.length} food item(s) from listPublicFoods.`);

        const foodRestaurantsMap = new Map();
        returnedFoods.forEach(f => {
            const restId = String(f.restaurantId);
            if (!foodRestaurantsMap.has(restId)) {
                foodRestaurantsMap.set(restId, { name: f.restaurantName, count: 0 });
            }
            foodRestaurantsMap.get(restId).count++;
        });

        console.log("-> Restaurants associated with returned foods in listPublicFoods:");
        foodRestaurantsMap.forEach((val, restId) => {
            console.log(`   - Rest ID: ${restId} | Name: "${val.name}" | Foods count: ${val.count}`);
        });

    } catch (error) {
        console.error("Error running test:", error);
    } finally {
        await mongoose.disconnect();
        console.log("\nDisconnected from MongoDB.");
    }
}

testUnder250BackendCalls();
