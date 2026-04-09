// models/Category.js
import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    image: { type: String, default: "" },
  },
  { timestamps: true },
);

export const Category = mongoose.model("Category", categorySchema);
