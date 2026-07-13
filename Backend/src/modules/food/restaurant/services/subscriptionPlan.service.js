import { FoodSubscriptionPlan } from "../models/subscriptionPlan.model.js";
import { ValidationError, NotFoundError } from "../../../../core/auth/errors.js";

export const createSubscriptionPlan = async (data = {}) => {
  const { name, price, durationValue, durationUnit, commissionRate, description } = data;

  if (!name || !String(name).trim()) {
    throw new ValidationError("Plan name is required");
  }
  if (price === undefined || Number(price) <= 0) {
    throw new ValidationError("Price must be greater than zero");
  }
  if (!durationValue || Number(durationValue) < 1) {
    throw new ValidationError("Duration value must be at least 1");
  }
  if (!durationUnit || !["days", "months", "years"].includes(durationUnit)) {
    throw new ValidationError("Invalid duration unit. Supported: days, months, years");
  }

  const rate = Number(commissionRate !== undefined ? commissionRate : 0);
  if (isNaN(rate) || rate < 0 || rate > 100) {
    throw new ValidationError("Commission rate must be between 0% and 100%");
  }

  const plan = new FoodSubscriptionPlan({
    name: String(name).trim(),
    price: Number(price),
    durationValue: Number(durationValue),
    durationUnit,
    commissionRate: rate,
    description: description ? String(description).trim() : "",
  });

  await plan.save();
  return plan.toObject();
};

export const getSubscriptionPlans = async (query = {}) => {
  const filter = {};
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive === "true" || query.isActive === true;
  }
  return await FoodSubscriptionPlan.find(filter).sort({ price: 1 }).lean();
};

export const getSubscriptionPlanById = async (id) => {
  const plan = await FoodSubscriptionPlan.findById(id).lean();
  if (!plan) {
    throw new NotFoundError("Subscription plan not found");
  }
  return plan;
};

export const updateSubscriptionPlan = async (id, data = {}) => {
  const plan = await FoodSubscriptionPlan.findById(id);
  if (!plan) {
    throw new NotFoundError("Subscription plan not found");
  }

  const { name, price, durationValue, durationUnit, commissionRate, description, isActive } = data;

  if (name !== undefined) {
    if (!String(name).trim()) throw new ValidationError("Plan name cannot be empty");
    plan.name = String(name).trim();
  }
  if (price !== undefined) {
    if (Number(price) <= 0) throw new ValidationError("Price must be greater than zero");
    plan.price = Number(price);
  }
  if (durationValue !== undefined) {
    if (Number(durationValue) < 1) throw new ValidationError("Duration value must be at least 1");
    plan.durationValue = Number(durationValue);
  }
  if (durationUnit !== undefined) {
    if (!["days", "months", "years"].includes(durationUnit)) {
      throw new ValidationError("Invalid duration unit");
    }
    plan.durationUnit = durationUnit;
  }
  if (commissionRate !== undefined) {
    const rate = Number(commissionRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      throw new ValidationError("Commission rate must be between 0% and 100%");
    }
    plan.commissionRate = rate;
  }
  if (description !== undefined) {
    plan.description = String(description).trim();
  }
  if (isActive !== undefined) {
    plan.isActive = Boolean(isActive);
  }

  await plan.save();
  return plan.toObject();
};

export const deleteSubscriptionPlan = async (id) => {
  const plan = await FoodSubscriptionPlan.findById(id);
  if (!plan) {
    throw new NotFoundError("Subscription plan not found");
  }
  // Soft delete / deactivate
  plan.isActive = false;
  await plan.save();
  return { success: true, message: "Subscription plan deactivated successfully" };
};
