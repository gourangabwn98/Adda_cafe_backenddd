// const mongoose = require("mongoose");
import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    tableNo: {
      type: Number,
      required: true,
      unique: true,
      min: 1,
      max: 50, // you can increase later
    },
    seats: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive", "Maintenance"],
      default: "Active",
    },
    notes: {
      type: String,
      maxlength: 200,
    },
  },
  { timestamps: true },
);

// Optional: Index for faster lookup
// tableSchema.index({ tableNo: 1 });

// module.exports = mongoose.model("Table", tableSchema);
export const Table = mongoose.model("Table", tableSchema);
