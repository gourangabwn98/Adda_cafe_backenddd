// const mongoose = require("mongoose");
import mongoose from "mongoose";

export const STAFF_ROLES = ["Waiter", "Chef", "Manager", "Others"];
export const isWaiterRole = (role) => !role || role === "Waiter";

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
    // Staff role. Only "Waiter" staff become the assigned waiter (and so
    // collect the bill) when they accept a Client order — see
    // orderController.acceptOrder. Records created before this field existed
    // have no role and are treated as "Waiter" (see isWaiterRole), since
    // that's how every staff account was used until now.
    role: {
      type: String,
      enum: STAFF_ROLES,
      default: "Waiter",
    },
    // createdBy: {
    //   type: mongoose.Schema.Types.ObjectId,
    //   ref: "User", // admin who created this chef
    //   required: true,
    // },
    createdBy: {
  type: mongoose.Schema.Types.ObjectId,
  ref: "User",
  required: false,
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
