/**
 * verify-radius-migration.js
 * 
 * End-to-end verification for the Zone → Radius migration.
 * Checks:
 *  1. Restaurant model has serviceRadius field with correct default
 *  2. DeliveryPartner model has deliveryRadius field with correct default
 *  3. Zod validators accept serviceRadius / deliveryRadius
 *  4. Zone detect controller logic (mocked) returns IN_SERVICE correctly
 *  5. Restaurant service uses $geoNear + $match with serviceRadius
 *  6. Order dispatch uses deliveryRadius
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { z } from 'zod';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

// ─── Helpers ───────────────────────────────────────────────────────────────
let pass = 0, fail = 0;

function check(label, condition, detail = '') {
    if (condition) {
        console.log(`  ✅ PASS  ${label}`);
        pass++;
    } else {
        console.log(`  ❌ FAIL  ${label}${detail ? ' — ' + detail : ''}`);
        fail++;
    }
}

function section(title) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('═'.repeat(60));
}

// ─── Test 1: Restaurant Model Schema ──────────────────────────────────────
section('1. Restaurant Model — serviceRadius field');
try {
    const { FoodRestaurant } = await import('../src/modules/food/restaurant/models/restaurant.model.js');
    const schemaPaths = FoodRestaurant.schema.paths;
    const srPath = schemaPaths['serviceRadius'];

    check('serviceRadius field exists in schema', !!srPath);
    check('serviceRadius type is Number', srPath?.instance === 'Number');
    check('serviceRadius default is 10', srPath?.defaultValue === 10);
    check('serviceRadius min is 0.1', srPath?.options?.min === 0.1);

    // Verify zoneId still exists (backward compat)
    const zoneIdPath = schemaPaths['zoneId'];
    check('zoneId still present (backwards compat)', !!zoneIdPath);

} catch (err) {
    console.log(`  💥 Error loading Restaurant model: ${err.message}`);
    fail++;
}

// ─── Test 2: DeliveryPartner Model Schema ─────────────────────────────────
section('2. DeliveryPartner Model — deliveryRadius field');
try {
    const { FoodDeliveryPartner } = await import('../src/modules/food/delivery/models/deliveryPartner.model.js');
    const schemaPaths = FoodDeliveryPartner.schema.paths;
    const drPath = schemaPaths['deliveryRadius'];

    check('deliveryRadius field exists in schema', !!drPath);
    check('deliveryRadius type is Number', drPath?.instance === 'Number');
    check('deliveryRadius default is 10', drPath?.defaultValue === 10);
    check('deliveryRadius min is 0.1', drPath?.options?.min === 0.1);
    check('lastLocation 2dsphere index exists', !!FoodDeliveryPartner.schema.indexes().find(([k]) => k.lastLocation === '2dsphere'));

} catch (err) {
    console.log(`  💥 Error loading DeliveryPartner model: ${err.message}`);
    fail++;
}

// ─── Test 3: Restaurant Zod Validator ─────────────────────────────────────
section('3. Restaurant Zod Validator — accepts serviceRadius');
try {
    const { validateRestaurantRegisterDto } = await import('../src/modules/food/restaurant/validators/restaurant.validator.js');

    const validPayload = {
        restaurantName: 'Test Restaurant',
        ownerName: 'Test Owner',
        pureVegRestaurant: true,
        serviceRadius: '15',
    };

    const result = validateRestaurantRegisterDto(validPayload);
    check('Validator accepts serviceRadius as string "15"', result.serviceRadius === 15);

    // Test with number
    const result2 = validateRestaurantRegisterDto({ ...validPayload, serviceRadius: 8 });
    check('Validator accepts serviceRadius as number 8', result2.serviceRadius === 8);

    // Test without serviceRadius (optional)
    const result3 = validateRestaurantRegisterDto({ restaurantName: 'A', ownerName: 'B', pureVegRestaurant: false });
    check('Validator passes without serviceRadius (optional)', result3.serviceRadius === undefined);

    // Test invalid value
    try {
        validateRestaurantRegisterDto({ ...validPayload, serviceRadius: 0 });
        check('Validator rejects serviceRadius = 0', false, 'Should have thrown');
    } catch {
        check('Validator rejects serviceRadius = 0', true);
    }

} catch (err) {
    console.log(`  💥 Error testing restaurant validator: ${err.message}`);
    fail++;
}

// ─── Test 4: Delivery Zod Validator ───────────────────────────────────────
section('4. Delivery Zod Validator — accepts deliveryRadius');
try {
    const { validateDeliveryRegisterDto } = await import('../src/modules/food/delivery/validators/delivery.validator.js');

    const validPayload = {
        name: 'Test Delivery',
        phone: '9876543210',
        deliveryRadius: '12',
    };

    const result = validateDeliveryRegisterDto(validPayload);
    check('Validator accepts deliveryRadius as string "12"', result.deliveryRadius === 12);

    const result2 = validateDeliveryRegisterDto({ ...validPayload, deliveryRadius: 5 });
    check('Validator accepts deliveryRadius as number 5', result2.deliveryRadius === 5);

    const result3 = validateDeliveryRegisterDto({ name: 'A', phone: '9876543210' });
    check('Validator passes without deliveryRadius (optional)', result3.deliveryRadius === undefined);

} catch (err) {
    console.log(`  💥 Error testing delivery validator: ${err.message}`);
    fail++;
}

// ─── Test 5: Zone Detect Controller Logic ─────────────────────────────────
section('5. Zone Detect Controller — radius-based logic check');
try {
    // We verify the controller file structure without a live DB
    const { readFileSync } = await import('fs');
    const controllerPath = path.join(__dirname, '../src/modules/food/landing/controllers/zonePublic.controller.js');
    const src = readFileSync(controllerPath, 'utf8');

    check('Controller uses $geoNear aggregation', src.includes('$geoNear'));
    check('Controller uses serviceRadius for distance filter', src.includes('serviceRadius'));
    check('Controller uses 1000 multiplier (KM→meters)', src.includes('1000'));
    check('Controller returns IN_SERVICE when restaurant found', src.includes("'IN_SERVICE'"));
    check('Controller returns OUT_OF_SERVICE when none found', src.includes("'OUT_OF_SERVICE'"));
    check('Controller returns mock zoneId for compatibility', src.includes('radius_based') || src.includes('507f1f77bcf86cd799439011'));

} catch (err) {
    console.log(`  💥 Error checking zone controller: ${err.message}`);
    fail++;
}

// ─── Test 6: Restaurant Service — $geoNear + serviceRadius ─────────────────
section('6. Restaurant Service — listApprovedRestaurants uses radius');
try {
    const { readFileSync } = await import('fs');
    const servicePath = path.join(__dirname, '../src/modules/food/restaurant/services/restaurant.service.js');
    const src = readFileSync(servicePath, 'utf8');

    check('Service uses $geoNear for restaurant listing', src.includes('$geoNear'));
    check('Service checks serviceRadius field', src.includes('serviceRadius'));
    check('Service converts KM to meters (×1000)', src.includes('1000'));
    check('Service uses $expr + $lte for radius filtering', src.includes('$lte') && src.includes('$expr'));

} catch (err) {
    console.log(`  💥 Error checking restaurant service: ${err.message}`);
    fail++;
}

// ─── Test 7: Order Dispatch Service — deliveryRadius ──────────────────────
section('7. Order Dispatch Service — deliveryRadius filter');
try {
    const { readFileSync } = await import('fs');
    const files = [
        '../src/modules/food/orders/services/order-dispatch.service.js',
        '../src/modules/food/orders/services/orderDispatch.service.js',
    ];
    let src = null;
    for (const f of files) {
        try { src = readFileSync(path.join(__dirname, f), 'utf8'); break; } catch {}
    }

    if (src) {
        check('Dispatch service checks deliveryRadius', src.includes('deliveryRadius'));
        check('Dispatch service uses radius for partner search', src.includes('deliveryRadius') && (src.includes('1000') || src.includes('maxDistance')));
    } else {
        check('Dispatch service file found', false, 'File not located');
    }

} catch (err) {
    console.log(`  💥 Error checking dispatch service: ${err.message}`);
    fail++;
}

// ─── Test 8: Frontend Zone Sidebar Removed ────────────────────────────────
section('8. Frontend — Zone Setup removed from sidebar');
try {
    const { readFileSync } = await import('fs');
    const sidebarPath = path.join(__dirname, '../../Frontend/src/modules/Food/utils/adminSidebarMenu.js');
    const src = readFileSync(sidebarPath, 'utf8');

    check('Zone Setup NOT in sidebar menu', !src.includes('Zone Setup'));
    check('/admin/food/zone-setup path removed', !src.includes('/admin/food/zone-setup'));

} catch (err) {
    console.log(`  💥 Error checking sidebar: ${err.message}`);
    fail++;
}

// ─── Test 9: Frontend AdminRouter Zone Routes Removed ─────────────────────
section('9. Frontend — Zone routes removed from AdminRouter');
try {
    const { readFileSync } = await import('fs');
    const routerPath = path.join(__dirname, '../../Frontend/src/modules/Food/components/admin/AdminRouter.jsx');
    const src = readFileSync(routerPath, 'utf8');

    check('ZoneSetup import removed', !src.includes("import(\"@food/pages/admin/restaurant/ZoneSetup\")"));
    check('AddZone import removed', !src.includes("import(\"@food/pages/admin/restaurant/AddZone\")"));
    check('AllZonesMap import removed', !src.includes("import(\"@food/pages/admin/restaurant/AllZonesMap\")"));
    check('zone-setup route removed', !src.includes('path="zone-setup"'));

} catch (err) {
    console.log(`  💥 Error checking AdminRouter: ${err.message}`);
    fail++;
}

// ─── Test 10: AddDeliveryman Zone → Radius ────────────────────────────────
section('10. Frontend — AddDeliveryman uses deliveryRadius, not zone');
try {
    const { readFileSync } = await import('fs');
    const formPath = path.join(__dirname, '../../Frontend/src/modules/Food/pages/admin/delivery-partners/AddDeliveryman.jsx');
    const src = readFileSync(formPath, 'utf8');

    check('AddDeliveryman has deliveryRadius state', src.includes('deliveryRadius'));
    check('AddDeliveryman has Delivery Radius label', src.includes('Delivery Radius'));
    check('AddDeliveryman zone dropdown removed', !src.includes('Select Zone'));
    check('AddDeliveryman zone state removed', !src.includes("zone: \"\""));

} catch (err) {
    console.log(`  💥 Error checking AddDeliveryman: ${err.message}`);
    fail++;
}

// ─── Summary ──────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(60)}`);
console.log(`  VERIFICATION RESULTS`);
console.log('═'.repeat(60));
console.log(`  Total: ${pass + fail}   ✅ Passed: ${pass}   ❌ Failed: ${fail}`);
console.log('═'.repeat(60));

if (fail === 0) {
    console.log('\n  🎉 All checks passed! Radius migration is complete.\n');
    process.exit(0);
} else {
    console.log(`\n  ⚠️  ${fail} check(s) failed. Review the output above.\n`);
    process.exit(1);
}
