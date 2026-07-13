import mongoose from "mongoose";

const restaurantSubscriptionSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodRestaurant",
      required: true,
      index: true,
    },
    planId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FoodSubscriptionPlan",
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true, index: true },
    pricePaid: { type: Number, required: true, min: 0 },
    paymentMethod: { type: String, enum: ["razorpay"], default: "razorpay" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
      index: true,
    },
    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
      index: true,
    },
    razorpayDetails: {
      orderId: { type: String },
      paymentId: { type: String },
      signature: { type: String },
    },
    lastWarningSentDate: { type: Date },
  },
  { collection: "food_restaurant_subscriptions", timestamps: true }
);

export const FoodRestaurantSubscription = mongoose.model(
  "FoodRestaurantSubscription",
  restaurantSubscriptionSchema
);
