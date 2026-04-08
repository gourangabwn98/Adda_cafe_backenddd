// const mongoose = require("mongoose");
import mongoose from "mongoose";

const chefSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true,
      match: [/^\d{10}$/, "Please enter a valid 10-digit phone number"],
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // admin who created this chef
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster lookup by phone
// chefSchema.index({ phone: 1 });

// module.exports = mongoose.model("Chef", chefSchema);
export const Chef = mongoose.model("Chef", chefSchema);
