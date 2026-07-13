import mongoose from "mongoose";

const subscriptionPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    durationValue: { type: Number, required: true, min: 1 },
    durationUnit: {
      type: String,
      required: true,
      enum: ["days", "months", "years"],
      default: "months",
    },
    commissionRate: { type: Number, default: 0, min: 0, max: 100 },
    description: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { collection: "food_subscription_plans", timestamps: true }
);

export const FoodSubscriptionPlan = mongoose.model(
  "FoodSubscriptionPlan",
  subscriptionPlanSchema
);
