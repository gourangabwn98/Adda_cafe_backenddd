// ─── models/Order.js ──────────────────────────────────────────────────────────
import mongoose from "mongoose";
const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
});

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, unique: true },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },

    isGuest: {
      type: Boolean,
      default: false,
    },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },
    orderType: {
      type: String,
      enum: ["Dining", "Take Away"],
      default: "Dining",
    },
    tableNo: { type: Number, default: null },
    status: {
      type: String,
      enum: [
        "Placed",
        "Preparing",
        "Ready",
        "delivered",
        "Completed",
        "Cancelled",
      ],
      default: "Placed",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    rating: { type: Number, min: 1, max: 5 },
    cancelDeadline: { type: Date },
  },
  { timestamps: true },
);

// Auto-generate orderId before save
orderSchema.pre("save", async function () {
  if (!this.orderId) {
    const count = await mongoose.model("Order").countDocuments();
    this.orderId = `ADDA${String(count + 1).padStart(5, "0")}`;
  }
  // next();
});

export const Order = mongoose.model("Order", orderSchema);
