import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    orders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
      },
    ],

    orderId: String,

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    isGuest: {
      type: Boolean,
      default: false,
    },

    orderType: {
      type: String,
      default: "Dining",
    },

    // 💰 Subtotal (before tax)
    subtotal: {
      type: Number,
      required: true,
    },

    // 🧾 Tax amount (GST)
    tax: {
      type: Number,
      required: true,
    },

    // 💳 Final payable amount
    total: {
      type: Number,
      required: true,
    },

    // 📦 Item snapshot
    items: [
      {
        name: String,
        price: Number,
        qty: Number,
      },
    ],
    tableNo: { type: Number, default: null },
    status: {
      type: String,
      enum: ["pending", "completed", "paid", "cancelled"],
      default: "pending",
    },

    paymentStatus: {
      type: String,
      enum: ["Pending", "Paid", "Failed"],
      default: "Pending",
    },

    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Invoice", invoiceSchema);
