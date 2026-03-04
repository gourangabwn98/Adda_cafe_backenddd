// ─── models/User.js ───────────────────────────────────────────────────────────
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    otp: { type: String },
    otpExpiry: { type: Date },
    isVerified: { type: Boolean, default: false },
    vegMode: { type: Boolean, default: false },
    language: { type: String, default: "English" },
  },
  { timestamps: true },
);

export const User = mongoose.model("User", userSchema);
