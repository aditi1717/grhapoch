import { FoodSubscriptionPlan } from "../models/subscriptionPlan.model.js";
import { FoodRestaurantSubscription } from "../models/restaurantSubscription.model.js";
import { ValidationError, NotFoundError } from "../../../../core/auth/errors.js";
import { FoodRestaurant } from "../models/restaurant.model.js";
import {
  createRazorpayOrder,
  verifyPaymentSignature,
  fetchRazorpayPayment,
  getRazorpayKeyId,
} from "../../orders/helpers/razorpay.helper.js";

const calculateEndDate = (startDate, val, unit) => {
  const end = new Date(startDate);
  const amount = Number(val);
  if (unit === "days") {
    end.setDate(end.getDate() + amount);
  } else if (unit === "months") {
    end.setMonth(end.getMonth() + amount);
  } else if (unit === "years") {
    end.setFullYear(end.getFullYear() + amount);
  }
  return end;
};

export const subscribeToPlan = async (restaurantId, planId) => {
  if (!restaurantId) throw new ValidationError("Restaurant ID is required");
  if (!planId) throw new ValidationError("Plan ID is required");

  const activeSub = await getCurrentSubscription(restaurantId);
  if (activeSub) {
    throw new ValidationError("You already have an active subscription plan");
  }

  const restaurant = await FoodRestaurant.findById(restaurantId).lean();
  if (!restaurant) throw new NotFoundError("Restaurant not found");

  const plan = await FoodSubscriptionPlan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) throw new NotFoundError("Active subscription plan not found");

  // If price is 0, activate immediately
  if (plan.price === 0) {
    const startDate = new Date();
    const endDate = calculateEndDate(startDate, plan.durationValue, plan.durationUnit);

    // Deactivate previous subscriptions
    await FoodRestaurantSubscription.updateMany(
      { restaurantId, status: "active" },
      { $set: { status: "expired" } }
    );

    const subscription = new FoodRestaurantSubscription({
      restaurantId,
      planId,
      startDate,
      endDate,
      pricePaid: 0,
      paymentMethod: "razorpay",
      paymentStatus: "paid",
      status: "active",
    });

    await subscription.save();
    return { subscription, isPaid: true };
  }

  // Otherwise, initiate Razorpay order
  const amountPaise = Math.round(plan.price * 100);
  const shortId = String(restaurantId).slice(-12);
  const rzOrder = await createRazorpayOrder(amountPaise, "INR", `sub_${shortId}_${Date.now()}`);

  const subscription = new FoodRestaurantSubscription({
    restaurantId,
    planId,
    startDate: new Date(),
    endDate: new Date(), // Set temporary, will adjust on payment verification
    pricePaid: plan.price,
    paymentMethod: "razorpay",
    paymentStatus: "pending",
    status: "cancelled", // Inactive until paid
    razorpayDetails: {
      orderId: rzOrder.id,
    },
  });

  await subscription.save();

  return {
    subscriptionId: subscription._id,
    orderId: rzOrder.id,
    price: plan.price,
    razorpayKeyId: getRazorpayKeyId(),
    isPaid: false,
  };
};

export const verifySubscriptionPayment = async (restaurantId, verifyData = {}) => {
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = verifyData;

  if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
    throw new ValidationError("Missing Razorpay payment parameters");
  }

  const subscription = await FoodRestaurantSubscription.findOne({
    restaurantId,
    "razorpayDetails.orderId": razorpayOrderId,
    paymentStatus: "pending",
  });

  if (!subscription) {
    throw new NotFoundError("Pending subscription not found for this order");
  }

  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  if (!isValid) {
    throw new ValidationError("Payment signature verification failed");
  }

  // Cross-check payment details with Razorpay
  let rzPayment;
  try {
    rzPayment = await fetchRazorpayPayment(razorpayPaymentId);
  } catch (err) {
    throw new ValidationError("Failed to fetch Razorpay payment details");
  }

  const expectedPaise = Math.round(subscription.pricePaid * 100);
  const paidPaise = Number(rzPayment?.amount);
  if (paidPaise !== expectedPaise || String(rzPayment?.order_id) !== razorpayOrderId) {
    subscription.paymentStatus = "failed";
    await subscription.save();
    throw new ValidationError("Razorpay payment details mismatch");
  }

  const plan = await FoodSubscriptionPlan.findById(subscription.planId).lean();
  if (!plan) throw new NotFoundError("Subscription plan not found");

  const startDate = new Date();
  const endDate = calculateEndDate(startDate, plan.durationValue, plan.durationUnit);

  // Deactivate previous active subscriptions for this restaurant
  await FoodRestaurantSubscription.updateMany(
    { restaurantId, status: "active" },
    { $set: { status: "expired" } }
  );

  subscription.startDate = startDate;
  subscription.endDate = endDate;
  subscription.paymentStatus = "paid";
  subscription.status = "active";
  subscription.razorpayDetails.paymentId = razorpayPaymentId;
  subscription.razorpayDetails.signature = razorpaySignature;

  await subscription.save();

  return subscription.toObject();
};

export const getCurrentSubscription = async (restaurantId) => {
  if (!restaurantId) throw new ValidationError("Restaurant ID is required");

  // Check if expired subscriptions need status update
  const now = new Date();
  await FoodRestaurantSubscription.updateMany(
    { restaurantId, status: "active", endDate: { $lt: now } },
    { $set: { status: "expired" } }
  );

  const activeSub = await FoodRestaurantSubscription.findOne({
    restaurantId,
    status: "active",
    endDate: { $gte: now },
  })
    .populate("planId")
    .lean();

  return activeSub || null;
};

export const checkAndSendSubscriptionExpiryWarnings = async () => {
  const { FoodBusinessSettings } = await import("../../admin/models/businessSettings.model.js");
  const { sendNotificationToOwner } = await import("../../../../core/notifications/firebase.service.js");
  
  const settings = await FoodBusinessSettings.findOne().lean();
  const alertConfig = settings?.subscriptionExpiryAlert || {
    daysBefore: 3,
    messageTemplate: "Your subscription plan '{planName}' is expiring in {daysRemaining} days. Please renew to keep enjoying commission-free orders."
  };

  const daysBefore = alertConfig.daysBefore || 3;
  const messageTemplate = alertConfig.messageTemplate || "Your subscription plan '{planName}' is expiring in {daysRemaining} days. Please renew to keep enjoying commission-free orders.";

  const now = new Date();
  const thresholdDate = new Date(now.getTime() + daysBefore * 24 * 60 * 60 * 1000);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Find all active subscriptions that expire within thresholdDate and haven't received a warning today
  const expiringSubscriptions = await FoodRestaurantSubscription.find({
    status: "active",
    endDate: { $lte: thresholdDate, $gt: now },
    $or: [
      { lastWarningSentDate: { $exists: false } },
      { lastWarningSentDate: null },
      { lastWarningSentDate: { $lt: startOfToday } }
    ]
  }).populate("planId");

  console.log(`[SUBSCRIPTION-ALERT] Found ${expiringSubscriptions.length} subscriptions nearing expiry.`);

  for (const sub of expiringSubscriptions) {
    try {
      const planName = sub.planId?.name || "Active Plan";
      const diffTime = Math.max(0, sub.endDate.getTime() - now.getTime());
      const daysRemaining = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      // Format template message
      let message = messageTemplate
        .replace(/{planName}/g, planName)
        .replace(/{daysRemaining}/g, String(daysRemaining))
        .replace(/{endDate}/g, sub.endDate.toLocaleDateString("en-IN"));

      console.log(`[SUBSCRIPTION-ALERT] Sending alert to Restaurant ${sub.restaurantId}: "${message}"`);

      // Dispatch FCM Push
      await sendNotificationToOwner({
        ownerType: "RESTAURANT",
        ownerId: sub.restaurantId,
        payload: {
          title: "Subscription Expiring Soon",
          body: message,
          data: {
            type: "SUBSCRIPTION_EXPIRING",
            endDate: sub.endDate.toISOString(),
            daysRemaining: String(daysRemaining)
          }
        }
      });

      // Update sent timestamp
      sub.lastWarningSentDate = new Date();
      await sub.save();
    } catch (err) {
      console.error(`[SUBSCRIPTION-ALERT] Failed to alert restaurant ${sub.restaurantId}:`, err);
    }
  }

  return { alertedCount: expiringSubscriptions.length };
};
