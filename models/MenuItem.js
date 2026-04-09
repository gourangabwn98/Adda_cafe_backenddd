// ─── models/User.js ───────────────────────────────────────────────────────────
import mongoose from "mongoose";

// ─── models/MenuItem.js ───────────────────────────────────────────────────────
const menuItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true },
    originalPrice: { type: Number },
    description: { type: String },
    // category: {
    //   type: String,
    //   enum: ["Burger", "Biryani", "Pizza", "Wrap", "Rice", "Drinks"],
    //   required: true,
    // },
    category: {
      type: String,
      required: true,
    },
    // categoryImage: { type: String, default: "🍔" },
    tag: { type: String, enum: ["Veg", "Non Veg"], required: true },
    image: {
      type: String,
      default: "", // empty instead of emoji
    },

    categoryImage: {
      type: String,
      default: "",
    },
    isAvailable: { type: Boolean, default: true },
    rating: { type: Number, default: 4.0 },
  },
  { timestamps: true },
);

export const MenuItem = mongoose.model("MenuItem", menuItemSchema);
