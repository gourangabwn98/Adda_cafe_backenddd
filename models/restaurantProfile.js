// models/restaurantProfile.model.js
// const mongoose = require("mongoose");
import mongoose from "mongoose";

const restaurantProfileSchema = new mongoose.Schema(
  {
    // ── Basic Info ─────────────────────────────────────────────────────────
    restaurantName: {
      type: String,
      required: [true, "Restaurant name is required"],
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: "",
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    contactPerson: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      type: String, // Cloudinary / S3 URL
      default: "",
    },

    // ── Address & Location ─────────────────────────────────────────────────
    address: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },

    // ── Range Settings ─────────────────────────────────────────────────────
    dineInRange: {
      type: Number,
      default: 50, // metres
    },
    deliveryRange: {
      type: Number,
      default: 5000, // metres
    },

    // ── Business Details ───────────────────────────────────────────────────
    fssaiNumber: {
      type: String,
      trim: true,
      default: "",
    },
    gstNumber: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
    },
    aboutRestaurant: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Operating Hours ────────────────────────────────────────────────────
    openingTime: {
      type: String, // "HH:MM"
      default: "09:00",
    },
    closingTime: {
      type: String,
      default: "22:00",
    },
    avgDeliveryTime: {
      type: Number, // minutes
      default: 30,
    },

    // ── Pricing & Delivery ─────────────────────────────────────────────────
    minOrderAmount: {
      type: Number,
      default: 0,
    },
    freeDeliveryAbove: {
      type: Number,
      default: 300,
    },
    deliveryBaseFee: {
      type: Number,
      default: 40,
    },
    deliveryFeePerKm: {
      type: Number,
      default: 8,
    },

    // ── Additional Charges ─────────────────────────────────────────────────
    serviceCharge: {
      type: Number,
      default: 0, // percentage
    },
    packingCharge: {
      type: Number,
      default: 0, // flat amount
    },

    // ── Social Media ───────────────────────────────────────────────────────
    socialInstagram: {
      type: String,
      trim: true,
      default: "",
    },
    socialFacebook: {
      type: String,
      trim: true,
      default: "",
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Services ───────────────────────────────────────────────────────────
    services: {
      dineIn: { type: Boolean, default: true },
      takeAway: { type: Boolean, default: true },
      delivery: { type: Boolean, default: true },
    },

    // ── Preferences ────────────────────────────────────────────────────────
    notificationSound: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// module.exports = mongoose.model("RestaurantProfile", restaurantProfileSchema);
export const RestaurantProfile = mongoose.model(
  "RestaurantProfile",
  restaurantProfileSchema,
);
