// ─── models/Order.js ──────────────────────────────────────────────────────────
import mongoose from "mongoose";
import { Counter } from "./Counter.js";
const orderItemSchema = new mongoose.Schema({
  menuItem: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MenuItem",
    required: true,
  },
  name: { type: String, required: true },
  price: { type: Number, required: true },
  qty: { type: Number, required: true, min: 1 },
  // Snapshot of the menu item's category at order time — used to decide
  // service-charge exemption (see utils/serviceCharge.js) without an extra
  // MenuItem lookup later (e.g. at invoice generation).
  category: { type: String },
  // Free-text prep note for this item (e.g. "no onions", "extra spicy"),
  // settable by admin, customer (client), or Waiter. Printed on the KOT —
  // see restaurant-print-service/index.js buildKOT(), which already prints
  // `item.notes` when present.
  notes: { type: String },
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

    // Which staff member (Chef doc — this app's "waiter" roster, see
    // Chef.js/chefController.js) placed this order via the Waiter app.
    // Only set for Waiter-placed orders; null/absent for Admin/Client
    // orders. `waiterName` is a denormalized snapshot (same pattern as
    // orderItemSchema.category) so display doesn't need a populate, and
    // still works if the Chef record is later renamed/deleted.
    chefId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Chef",
    },
    waiterName: { type: String },
    items: [orderItemSchema],
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    serviceCharge: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    // Flat delivery charge (see RestaurantProfile.deliveryBaseFee /
    // freeDeliveryAbove) — only set when orderType is "Delivery".
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    orderType: {
      type: String,
      enum: ["Dining", "Take Away", "Delivery"],
      default: "Dining",
    },
    tableNo: { type: Number, default: null },
    // Only set when orderType is "Delivery".
    deliveryAddress: { type: String },
    deliveryPhone: { type: String },
    status: {
      type: String,
      enum: [
        "PendingConfirmation",
        "Placed",
        "Preparing",
        "Ready",
        "delivered",
        "Completed",
        "Cancelled",
      ],
      default: "PendingConfirmation",
    },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },
    // How the customer/staff said they'll pay — distinct from paymentStatus
    // (which tracks whether that payment has actually been confirmed). No
    // default at the schema level so older orders created before this field
    // existed keep reading back fine with paymentMethod simply absent; new
    // orders get a value from orderController.placeOrder (defaults to
    // "Cash" there if the client didn't send one).
    paymentMethod: {
      type: String,
      enum: ["Cash", "Online"],
    },
    rating: { type: Number, min: 1, max: 5 },
    cancelDeadline: { type: Date },
    // Set when staff decline a PendingConfirmation order (e.g. item
    // unavailable, kitchen too busy). Only meaningful when status is
    // "Cancelled" as a result of a decline rather than a customer cancel.
    declineReason: { type: String },
  },
  { timestamps: true },
);

// Auto-generate orderId before save — atomic counter (see models/Counter.js).
// Previously counted existing documents (Order.countDocuments()), which
// broke as soon as any order was ever deleted: the live count could drop
// below a number already in use by a surviving order, producing
// "E11000 duplicate key ... orderId_1" on the next order placed. $inc is
// atomic, so it also can't collide under concurrent order placement
// (Admin/Waiter/Client all creating orders at once), unlike the old approach.
orderSchema.pre("save", async function () {
  if (!this.orderId) {
    const counter = await Counter.findByIdAndUpdate(
      "orderId",
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.orderId = `ADDA${String(counter.seq).padStart(5, "0")}`;
  }
  // next();
});

export const Order = mongoose.model("Order", orderSchema);
