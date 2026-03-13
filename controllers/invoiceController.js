import Invoice from "../models/invoiceModel.js";
import { Order } from "../models/Order.js";
// import Order from "../models/orderModel.js";

// 🔹 Generate Invoice
// export const generateInvoice = async (req, res) => {
//   try {
//     const { orders, items, userId, isGuest } = req.body;

//     // 🧮 Calculate subtotal
//     const subtotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);

//     const taxRate = 0.18; // 18% GST
//     const tax = subtotal * taxRate;

//     const total = subtotal + tax;

//     const invoice = await Invoice.create({
//       orders,
//       user: userId || null,
//       isGuest,
//       items,
//       subtotal,
//       tax,
//       total,
//     });

//     res.status(201).json(invoice);
//   } catch (err) {
//     res.status(500).json({ message: "Failed to generate invoice" });
//   }
// };
export const generateInvoice = async (req, res) => {
  try {
    const { orders, items, userId, isGuest } = req.body;

    const safeItems = items || [];

    const subtotal = safeItems.reduce(
      (sum, i) => sum + (i.price || 0) * (i.qty || 0),
      0,
    );

    const taxRate = 0.18;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    // ✅ Fix invalid guest userId
    const safeUserId = userId && userId !== "guest" ? userId : null;

    const invoice = await Invoice.create({
      orders: orders || [],
      user: safeUserId,
      isGuest: isGuest || false,
      items: safeItems,
      subtotal,
      tax,
      total,
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
};

// 🔹 Get My Invoices
export const getMyInvoices = async (req, res) => {
  try {
    let invoices;

    // 🔹 Logged-in user
    if (req.user) {
      invoices = await Invoice.find({ user: req.user._id }).sort({
        createdAt: -1,
      });
    }

    // 🔹 Guest user (using query or header)
    else {
      invoices = await Invoice.find({ isGuest: true }).sort({
        createdAt: -1,
      });
    }

    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};
