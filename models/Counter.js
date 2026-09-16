// ─── models/Counter.js ────────────────────────────────────────────────────────
// A tiny generic counter collection for atomically generating sequential IDs
// (currently just Order.orderId — see Order.js's pre-save hook). Using
// findByIdAndUpdate's atomic $inc means two orders created at the same
// instant can never be assigned the same number, unlike counting existing
// documents (Order.countDocuments()), which breaks the moment any order is
// ever deleted (the count silently goes backwards, and the next "count + 1"
// can collide with an order that's still there) — that was the exact cause
// of the "E11000 duplicate key ... orderId_1" errors.
import mongoose from "mongoose";

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "orderId"
  seq: { type: Number, default: 0 },
});

export const Counter = mongoose.model("Counter", counterSchema);
