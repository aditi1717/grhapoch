import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const restaurantSchema = new mongoose.Schema({
    restaurantName: String,
    serviceRadius: { type: Number, default: 10 }
}, { collection: 'food_restaurants' });

const deliveryPartnerSchema = new mongoose.Schema({
    name: String,
    deliveryRadius: { type: Number, default: 10 }
}, { collection: 'food_delivery_partners' });

const FoodRestaurant = mongoose.model('FoodRestaurant', restaurantSchema);
const FoodDeliveryPartner = mongoose.model('FoodDeliveryPartner', deliveryPartnerSchema);

async function runMigration() {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in the environment variables.');
        }

        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected successfully!');

        const db = mongoose.connection.db;
        const restaurantsColl = db.collection('food_restaurants');
        const partnersColl = db.collection('food_delivery_partners');

        const totalRest = await restaurantsColl.countDocuments({});
        const totalPartner = await partnersColl.countDocuments({});
        console.log(`Total restaurants in DB: ${totalRest}`);
        console.log(`Total partners in DB: ${totalPartner}`);

        const hasRestRadius = await restaurantsColl.countDocuments({ serviceRadius: { $exists: true } });
        const hasPartnerRadius = await partnersColl.countDocuments({ deliveryRadius: { $exists: true } });
        console.log(`Restaurants with serviceRadius physically in DB: ${hasRestRadius}`);
        console.log(`Partners with deliveryRadius physically in DB: ${hasPartnerRadius}`);

        // Migrate Restaurants
        const restResult = await restaurantsColl.updateMany(
            { serviceRadius: { $exists: false } },
            { $set: { serviceRadius: 10 } }
        );
        console.log(`Restaurants migrated: Modified ${restResult.modifiedCount} of ${restResult.matchedCount} records.`);

        // Migrate Delivery Partners
        const partnerResult = await partnersColl.updateMany(
            { deliveryRadius: { $exists: false } },
            { $set: { deliveryRadius: 10 } }
        );
        console.log(`Delivery Partners migrated: Modified ${partnerResult.modifiedCount} of ${partnerResult.matchedCount} records.`);

        await mongoose.disconnect();
        console.log('Database connection closed. Migration completed successfully.');
    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
}

runMigration();
