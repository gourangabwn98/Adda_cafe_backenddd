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
    const { orders, items, userId, isGuest, tableNo } = req.body;
    console.log("tableNo", tableNo);

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
      tableNo: tableNo || null,
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

export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
};
export const getAllInvoices = async (req, res) => {
  try {
    const {
      status,
      userId,
      isGuest,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const query = {};

    // Optional filters
    if (status) query.status = status;
    if (userId) query.user = userId;
    if (isGuest !== undefined) query.isGuest = isGuest === "true";
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const invoices = await Invoice.find(query)
      .populate("user", "name phone email") // optional: populate user info
      .populate("orders", "orderId tableNo status total") // optional: populate orders
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.json({
      success: true,
      count: invoices.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: invoices,
    });
  } catch (err) {
    console.error("getAllInvoices error:", err);
    res.status(500).json({ message: "Failed to fetch all invoices" });
  }
};

// ────────────────────────────────────────────────
// 2. Update Invoice Status (Admin only)
// ────────────────────────────────────────────────
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, notes } = req.body;

    // Allowed statuses (you can adjust this list)
    const allowedStatuses = [
      "pending",
      "completed",
      "paid",
      "cancelled",
      "refunded",
    ];

    if (!status || !allowedStatuses.includes(status)) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Optional: prevent changing already completed invoices
    if (invoice.status === "completed" && status !== "refunded") {
      return res
        .status(403)
        .json({ message: "Cannot modify completed invoice" });
    }

    invoice.status = status;

    if (paymentStatus) {
      invoice.paymentStatus = paymentStatus;
    }

    if (notes) {
      invoice.notes =
        (invoice.notes || "") + `\n${new Date().toISOString()} - ${notes}`;
    }

    // If completing / paid → also complete related orders
    if (["completed", "paid"].includes(status)) {
      await Order.updateMany(
        { _id: { $in: invoice.orders } },
        { $set: { status: "Completed", paymentStatus: "Paid" } },
      );
    }

    // If cancelled / refunded → revert orders if needed
    if (["cancelled", "refunded"].includes(status)) {
      await Order.updateMany(
        { _id: { $in: invoice.orders } },
        { $set: { status: "Cancelled" } },
      );
    }

    const updatedInvoice = await invoice.save();

    res.json({
      success: true,
      message: `Invoice status updated to ${status}`,
      data: updatedInvoice,
    });
  } catch (err) {
    console.error("updateInvoiceStatus error:", err);
    res.status(500).json({ message: "Failed to update invoice status" });
  }
};
