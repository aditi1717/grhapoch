# Food Delivery App - Migration Plan (Zone Based → Radius Based)

This document provides a comprehensive migration report and implementation plan for transitioning the application from a Zone-based architecture to a Radius-based service architecture.

---

## Phase 1 - Analyze the Existing System

### Admin
* **How are Zones created?**
  Zones are created by an administrator in the admin dashboard. The admin uses a Google Maps drawing manager to define a polygon region (at least 3 coordinates) and assigns a name, country, and service location.
* **Which database collection stores Zones?**
  The database collection is `food_zones` mapped to the `FoodZone` model defined in [zone.model.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/admin/models/zone.model.js).
* **What fields exist in the Zone model?**
  * `name`: String (required, trimmed, index)
  * `zoneName`: String
  * `country`: String (default 'India')
  * `serviceLocation`: String
  * `unit`: String ('kilometer' or 'miles')
  * `coordinates`: Array of `{ latitude, longitude }` (minimum 3 coordinates representing a closed polygon)
  * `isActive`: Boolean (default true, index)
* **Which APIs create, update, delete, and fetch Zones?**
  All Zone CRUD APIs are handled in [admin.routes.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/admin/routes/admin.routes.js) and resolved through [admin.controller.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/admin/controllers/admin.controller.js) and [admin.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/admin/services/admin.service.js):
  * `GET /zones` -> `adminController.getZones`
  * `GET /zones/:id` -> `adminController.getZoneById`
  * `POST /zones` -> `adminController.createZone`
  * `PATCH /zones/:id` -> `adminController.updateZone`
  * `DELETE /zones/:id` -> `adminController.deleteZone`
* **Which admin pages manage Zones?**
  Zone management in the admin frontend is found in [adminSidebarMenu.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/utils/adminSidebarMenu.js) and [AdminRouter.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/components/admin/AdminRouter.jsx):
  * `/admin/food/zone-setup` -> [ZoneSetup.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/ZoneSetup.jsx)
  * `/admin/food/zone-setup/add` and `/edit/:id` -> [AddZone.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/AddZone.jsx)
  * `/admin/food/zone-setup/map` -> [AllZonesMap.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/AllZonesMap.jsx)
  * `/admin/food/zone-setup/view/:id` -> [ViewZone.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/ViewZone.jsx)

---

### Restaurant
* **How is a restaurant assigned to a Zone?**
  When a restaurant sets its coordinates (via Google Maps pin), the backend calls `findMatchedZoneForCoordinates(lat, lng)` which checks the restaurant's coordinates against all active zone polygons using a ray-casting point-in-polygon containment check. If contained, the restaurant is assigned to that zone.
* **Which database field stores the Zone?**
  * `zoneId`: Refers to `FoodZone` (ObjectId, indexed).
  * `pendingZoneId`: Refers to `FoodZone` (ObjectId) representing a proposed location update awaiting admin approval.
* **Which APIs use the Zone while creating or updating restaurants?**
  * `registerRestaurant` and `updateRestaurantProfile` in [restaurant.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/services/restaurant.service.js) resolve the zone dynamically from coordinates and assign it.
* **Where is the Zone selected in the admin panel?**
  * Admin panel restaurant creation: [AddRestaurant.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/AddRestaurant.jsx).
  * Restaurant onboarding: [Onboarding.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/restaurant/Onboarding.jsx).
  * Restaurant profile editing: [EditRestaurant.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/EditRestaurant.jsx) and restaurant dashboard [ZoneSetup.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/restaurant/ZoneSetup.jsx).

---

### User App
* **Which API fetches restaurants?**
  * `GET /food/restaurant/restaurants` -> `listApprovedRestaurants` service in [restaurant.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/services/restaurant.service.js).
* **Where does the Zone filtering happen?**
  * It occurs during listing queries by checking the `zoneId` field: `filter.zoneId = new mongoose.Types.ObjectId(zoneIdRaw)`.
* **Is filtering performed in MongoDB or in backend logic?**
  * Filtering is performed directly in MongoDB queries and aggregation pipelines.
* **Is the user's location used at all?**
  * Yes. The frontend hooks use GPS coordinates to request zone detection (`GET /food/zones/detect?lat=..&lng=..`). Once detected, the returned `zoneId` is used to filter restaurant lists, banners, and categories.
  * User coordinates are also used for distance-based sorting (`$geoNear`) if a radius filter or "nearest" sort is applied.
* **Which files contain this logic?**
  * Backend: [restaurant.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/services/restaurant.service.js) (`listApprovedRestaurants`), [zonePublic.controller.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/landing/controllers/zonePublic.controller.js) (`detectZonePublicController`).
  * Frontend: [useZone.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/hooks/useZone.jsx) (zone detection hook), [Home.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/user/Home.jsx), [Restaurants.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/user/restaurants/Restaurants.jsx).

---

### Delivery Partner
* **How is a delivery partner assigned to a Zone?**
  * Delivery partners are actually *not* bound to a zone in their database model or dispatch flow. They are tracked dynamically by location (`lastLat`, `lastLng`, `lastLocation`).
* **Which APIs assign orders?**
  * `tryAutoAssign` in [order-dispatch.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/orders/services/order-dispatch.service.js).
* **Which files determine eligible delivery partners?**
  * [order-dispatch.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/orders/services/order-dispatch.service.js) (`listNearbyOnlineDeliveryPartners`).
* **Is Socket.io used?**
  * Yes, Socket.io is used to push `new_order` notifications to the delivery partners.
* **Is Firebase used?**
  * Yes, Firebase Realtime Database is used for live location tracking (`active_orders/{orderId}`). Firebase Cloud Messaging (FCM) is used to send push notifications.
* **Is polling used?**
  * No polling is used. Order assignment retry is managed asynchronously using a job queue (Bull) through `addOrderJob` timeout intervals.
* **Document the complete order assignment flow:**
  ```mermaid
  sequenceDiagram
      participant App as Order Queue (Bull)
      participant Service as Dispatch Service
      participant Partner as Delivery Partner (Socket)
      
      App->>Service: Trigger tryAutoAssign(orderId)
      Service->>Service: Find nearby online partners (within maxKm limit)
      Service->>Service: Filter out busy partners & cash limit conflicts
      Note over Service: Distance computed via Haversine
      alt Eligible partners found
          Service->>Partner: Emit Socket Event 'new_order'
          Service->>Partner: Send FCM Push Notification
          Service->>App: Queue check-in task in 60s
      else No partners found
          Service->>App: Expand radius (15km -> 25km -> 40km -> 60km)
          Service->>App: Re-queue task in 30s
      end
  ```

---

### Database
Every database collection referencing Zones:
1. **`food_zones`**: Zone definitions (coordinates, country, unit, names).
2. **`food_restaurants`**: Mapped via `zoneId` and `pendingZoneId` (ObjectId ref: 'FoodZone').
3. **`food_categories`**: Mapped via `zoneId` (ObjectId ref: 'FoodZone', allows zone-specific categories).
4. **`food_home_promotion_banners`**: Mapped via `zoneId` (ObjectId ref: 'FoodZone').
5. **`food_under250_banners`**: Mapped via `zoneId` (stored as String).

---

## Phase 2 - Radius Based Design

We will replace zone boundaries with dynamic coordinates and operational radii:

### Restaurant
* `location`: GeoJSON Point (existing)
* `serviceRadius`: Number (KM) - determines coverage bounds for user visibility.

### Delivery Partner
* `lastLocation`: GeoJSON Point (existing)
* `deliveryRadius`: Number (KM) - determines maximum dispatch distance.

### User
* `currentLocation`: Latitude/Longitude coordinates parsed directly from the GPS sensor on the client.

---

## Phase 3 - Migration Plan

| Area | Current Implementation (Zone-Based) | New Implementation (Radius-Based) |
|---|---|---|
| **Database** | `food_zones` collection holds polygons. Restaurants, categories, and banners point to `zoneId`. | Keep `zoneId` fields temporarily for backwards-compatibility. Add `serviceRadius` (restaurants) and `deliveryRadius` (partners). Add 2dsphere index to restaurant locations. |
| **APIs** | `/zones/detect` checks polygon inclusion; `/restaurants` filters by `zoneId`. | `/zones/detect` queries restaurants within their service radius covering the user's coordinates. `/restaurants` uses `$geoNear` + `$match` on distance vs `serviceRadius`. |
| **Frontend** | `useZone` loads `zoneId` based on polygon; Out-of-Zone screens display if no zone detected. | `useZone` calls `/zones/detect` which returns `IN_SERVICE` if at least one restaurant is nearby. |
| **Admin Panel** | Zone drawing tool, zone listings, zone permissions. | Remove Zone setup. Replace with Restaurant settings for lat/lng on map and a numeric `serviceRadius` field. Add `deliveryRadius` to delivery partner profiles. |
| **Delivery Assignment** | Search for riders within hardcoded, scaling distances (15km, 25km, 40km, 60km). | Calculate distance from Restaurant to Rider. Request assignment if `distance <= rider.deliveryRadius`. |

---

## Phase 4 - Admin Changes

### Removed Features
* Complete removal of `Zone Setup` (/admin/food/zone-setup) from [adminSidebarMenu.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/utils/adminSidebarMenu.js) and [AdminRouter.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/components/admin/AdminRouter.jsx).

### New Features
* **Restaurant Form**:
  * Location Picker (Google Maps map instance) to select latitude and longitude.
  * Numeric input: `Service Radius (KM)`.
* **Delivery Partner Form**:
  * Map display showing their current/last active coordinates.
  * Numeric input: `Delivery Radius (KM)`.
* **Global Settings**:
  * `defaultRestaurantRadius`: 10 (KM)
  * `defaultDeliveryRadius`: 10 (KM)

---

## Phase 5 - Restaurant Visibility

### Calculations
When a user opens the app, the frontend sends coordinates `(userLat, userLng)`. The database uses a 2dsphere geolocation lookup to return restaurants that serve this location:

```javascript
// MongoDB Aggregation Pipeline inside listApprovedRestaurants
const userLng = Number(query.lng);
const userLat = Number(query.lat);

const pipeline = [
    {
        $geoNear: {
            near: { type: 'Point', coordinates: [userLng, userLat] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: { status: 'approved', isActive: true } // existing filter status
        }
    },
    {
        $match: {
            $expr: {
                $lte: [
                    "$distanceMeters",
                    { $multiply: [ { $ifNull: ["$serviceRadius", DEFAULT_RESTAURANT_RADIUS] }, 1000 ] }
                ]
            }
        }
    }
];
```

### Why GeoJSON + 2dsphere?
Yes, **2dsphere** index is required on `FoodRestaurant.location` to calculate precise spherical distances on Earth. It is already present on the schema. Using `$geoNear` as the first stage enables indexing, which prevents full-collection scans and guarantees sub-millisecond response times.

---

## Phase 6 - Delivery Assignment

The dispatch timeout algorithm (`tryAutoAssign`) will be refactored:

```javascript
// Inside order-dispatch.service.js
async function listNearbyOnlineDeliveryPartners(restaurant, { limit = 25 } = {}) {
    const [rLng, rLat] = restaurant.location.coordinates;

    // Fetch online delivery partners
    const partners = await FoodDeliveryPartner.find({
        availabilityStatus: 'online',
        status: 'approved'
    }).lean();

    const eligible = [];
    for (const p of partners) {
        if (p.lastLat == null || p.lastLng == null) continue;
        
        const d = haversineKm(rLat, rLng, p.lastLat, p.lastLng);
        const maxRadius = p.deliveryRadius || DEFAULT_DELIVERY_RADIUS;
        
        if (Number.isFinite(d) && d <= maxRadius) {
            eligible.push({ partnerId: p._id, distanceKm: d, status: p.status });
        }
    }

    // Sort by nearest
    eligible.sort((a, b) => a.distanceKm - b.distanceKm);
    return { partners: eligible.slice(0, limit) };
}
```

---

## Phase 7 - Code Impact Report

### Models to Modify
* [restaurant.model.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/models/restaurant.model.js): Add `serviceRadius` field (Number, default 10).
* [deliveryPartner.model.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/delivery/models/deliveryPartner.model.js): Add `deliveryRadius` field (Number, default 10).

### Services to Modify
* [restaurant.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/services/restaurant.service.js): Update `listApprovedRestaurants` to use `$geoNear` + `$match` (dynamic service radius check) instead of the `zoneId` match query.
* [order-dispatch.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/orders/services/order-dispatch.service.js): Update `listNearbyOnlineDeliveryPartners` to evaluate the dynamic `deliveryRadius` of the driver rather than scaling maxKm parameters.

### Controllers to Modify
* [zonePublic.controller.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/landing/controllers/zonePublic.controller.js): Refactor `detectZonePublicController` to perform a restaurant search. If at least 1 restaurant covers the coordinates, return `IN_SERVICE` with a dummy `zoneId: "radius_based"` and a mock `zone` payload to keep the frontend running.

### Frontend Screens to Modify
* [adminSidebarMenu.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/utils/adminSidebarMenu.js) & [AdminRouter.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/components/admin/AdminRouter.jsx): Remove Zone Setup paths.
* [AddRestaurant.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/AddRestaurant.jsx) & [EditRestaurant.jsx](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Frontend/src/modules/Food/pages/admin/restaurant/EditRestaurant.jsx): Replace Zone selectors with a numeric `Service Radius (KM)` input field.

### Database Migrations Required
* Initialize `serviceRadius = 10` on all existing restaurants.
* Initialize `deliveryRadius = 10` on all existing delivery partners.

### Effort & Risk
* **Estimated Effort**: 2-3 Weeks.
* **Possible Breaking Changes**: Banners and Category filtering that depend on `zoneId` must fall back to the user's lat/lng to fetch corresponding records.

---

## Phase 8 - Migration Safety

1. **Restaurants Migration**: Run a background database migration script. Sets `serviceRadius = 10` (default) on every restaurant record.
2. **Delivery Partners Migration**: Run migration script setting `deliveryRadius = 10` (default) on all delivery boys.
3. **Active Orders**: Order states (`pending`, `confirmed`, `preparing`, etc.) do not hold zone-specific execution variables. The dispatch queue (`tryAutoAssign`) checks dynamically. New code deployments will seamlessly calculate assignments on current orders.
4. **Zero Downtime**:
   * **Step A**: Deploy the new backend fields and updated listing/dispatch logic. Maintain a backwards-compatible `/zones/detect` API that returns a mock `zoneId` ("radius_based"). Banners and Category APIs are refactored to ignore `zoneId` and return all active records.
   * **Step B**: Deploy updated admin forms and user application bundles.
   * **Step C**: Verify system performance. Once verified, run cleanup scripts to drop the `food_zones` collection.

---

## Phase 9 - Implementation Order

- **Step 1**: Add new fields (`serviceRadius` and `deliveryRadius`) to [restaurant.model.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/models/restaurant.model.js) and [deliveryPartner.model.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/delivery/models/deliveryPartner.model.js).
- **Step 2**: Write and run DB migration scripts to assign default values to existing documents.
- **Step 3**: Refactor [zonePublic.controller.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/landing/controllers/zonePublic.controller.js) to support compatibility mock responses.
- **Step 4**: Update restaurant visibility query in `listApprovedRestaurants` within [restaurant.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/restaurant/services/restaurant.service.js) to filter by spherical distance vs `serviceRadius`.
- **Step 5**: Update delivery assignment calculation in [order-dispatch.service.js](file:///c:/Users/aditi/OneDrive/Desktop/company%20project/grhapoch/Backend/src/modules/food/orders/services/order-dispatch.service.js) to use individual driver radius limit.
- **Step 6**: Update admin forms for Restaurants and Delivery Partners in the frontend to capture service and delivery radii.
- **Step 7**: Remove Zone Setup path references from navigation and routing trees in the frontend.
- **Step 8**: Conduct full E2E testing (User listing, Checkout, Dispatch loop).
- **Step 9**: Safe deployment.
