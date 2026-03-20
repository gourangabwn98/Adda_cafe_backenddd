// ─── controllers/adminController.js ─────────────────────────────────────────
import { User } from "../models/User.js";
import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";
import Invoice from "../models/invoiceModel.js";

// GET /api/admin/dashboard
export const getDashboardStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalItems,
      totalOrders,
      totalInvoices,
      revenueAgg,
      todayOrdersAgg,
      ordersByStatus,
      recentOrders,
      topItems,
      weeklyRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      MenuItem.countDocuments({ isAvailable: true }),
      Order.countDocuments(),
      Invoice.countDocuments(),

      // Total revenue (paid orders only)
      Order.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),

      // Today's orders
      Order.aggregate([
        {
          $match: {
            createdAt: {
              $gte: new Date(new Date().setHours(0, 0, 0, 0)),
              $lte: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
      ]),

      // Orders grouped by status
      Order.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
            revenue: { $sum: "$total" },
          },
        },
      ]),

      // Recent 10 orders with user info
      Order.find()
        .sort({ createdAt: -1 })
        .limit(10)
        .populate("user", "name phone")
        .lean(),

      // Top 5 ordered menu items
      Order.aggregate([
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            totalQty: { $sum: "$items.qty" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.qty"] } },
          },
        },
        { $sort: { totalQty: -1 } },
        { $limit: 5 },
      ]),

      // Last 7 days revenue
      Order.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            paymentStatus: "Paid",
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            revenue: { $sum: "$total" },
            orders: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Build table-status map  {Placed:[], Preparing:[], ...}
    const TABLE_STATUSES = [
      "Placed",
      "Preparing",
      "Ready",
      "Completed",
      "Cancelled",
      "All",
    ];
    const tableOrders = {};
    for (const s of TABLE_STATUSES) {
      tableOrders[s] = await Order.find(s === "All" ? {} : { status: s })
        .sort({ createdAt: -1 })
        .limit(20)
        .populate("user", "name phone")
        .lean();
    }

    res.json({
      stats: {
        totalUsers,
        totalItems,
        totalOrders,
        totalInvoices,
        totalRevenue: revenueAgg[0]?.total || 0,
        todayOrders: todayOrdersAgg[0]?.count || 0,
        todayRevenue: todayOrdersAgg[0]?.revenue || 0,
      },
      ordersByStatus,
      recentOrders,
      topItems,
      weeklyRevenue,
      tableOrders,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Dashboard error" });
  }
};

// GET /api/admin/orders  (all orders, paginated)
export const getAllOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status && status !== "All") filter.status = status;
    if (search) filter.orderId = { $regex: search, $options: "i" };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("user", "name phone"),
      Order.countDocuments(filter),
    ]);
    res.json({
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/orders/:id/status
export const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true },
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/users
export const getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [users, total] = await Promise.all([
      User.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .select("-otp -otpExpiry"),
      User.countDocuments(),
    ]);
    res.json({ users, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE /api/admin/users/:id
export const deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const getAllInvoices = async (req, res) => {
  try {
    // Optional: log who is calling (useful for debugging)
    console.log(
      "[getAllInvoices] Called by:",
      req.user?._id || "unauthenticated",
    );

    const invoices = await Invoice.find()
      .sort({ createdAt: -1 }) // newest first
      .populate("user", "name phone email") // populate user fields (add more if needed)
      .lean(); // faster response (optional but good)

    // Optional debug log
    console.log(`Found ${invoices.length} invoices`);

    // Send proper successful response
    return res.status(200).json({
      success: true,
      count: invoices.length,
      invoices,
    });
  } catch (err) {
    // Detailed error logging (very helpful)
    console.error("getAllInvoices error:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });

    // Send proper error response to client
    return res.status(500).json({
      success: false,
      message: "Failed to fetch all invoices",
      // Only show detailed error in development
      ...(process.env.NODE_ENV === "development" && { error: err.message }),
    });
  }
};

// ────────────────────────────────────────────────
// 2. Update Invoice Status (Admin only)
// ────────────────────────────────────────────────
// export const updateInvoiceStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status, paymentStatus, notes } = req.body;

//     // Allowed statuses (you can adjust this list)
//     const allowedStatuses = [
//       "pending",
//       "completed",
//       "paid",
//       "cancelled",
//       "refunded",
//     ];

//     if (!status || !allowedStatuses.includes(status)) {
//       return res.status(400).json({
//         message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
//       });
//     }

//     const invoice = await Invoice.findById(id);

//     if (!invoice) {
//       return res.status(404).json({ message: "Invoice not found" });
//     }

//     // Optional: prevent changing already completed invoices
//     if (invoice.status === "completed" && status !== "refunded") {
//       return res
//         .status(403)
//         .json({ message: "Cannot modify completed invoice" });
//     }

//     invoice.status = status;

//     if (paymentStatus) {
//       invoice.paymentStatus = paymentStatus;
//     }

//     if (notes) {
//       invoice.notes =
//         (invoice.notes || "") + `\n${new Date().toISOString()} - ${notes}`;
//     }

//     // If completing / paid → also complete related orders
//     if (["completed", "paid"].includes(status)) {
//       await Order.updateMany(
//         { _id: { $in: invoice.orders } },
//         { $set: { status: "Completed", paymentStatus: "Paid" } },
//       );
//     }

//     // If cancelled / refunded → revert orders if needed
//     if (["cancelled", "refunded"].includes(status)) {
//       await Order.updateMany(
//         { _id: { $in: invoice.orders } },
//         { $set: { status: "Cancelled" } },
//       );
//     }

//     const updatedInvoice = await invoice.save();

//     res.json({
//       success: true,
//       message: `Invoice status updated to ${status}`,
//       data: updatedInvoice,
//     });
//   } catch (err) {
//     console.error("updateInvoiceStatus error:", err);
//     res.status(500).json({ message: "Failed to update invoice status" });
//   }
// };
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, paymentStatus, notes } = req.body;

    // Allowed invoice statuses
    const allowedStatuses = [
      "pending",
      "completed",
      "paid",
      "cancelled",
      "refunded",
    ];

    if (!status || !allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
      });
    }

    // Find the invoice
    const invoice = await Invoice.findById(id);

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Optional: prevent changing already completed invoices (except refund)
    if (invoice.status === "completed" && status.toLowerCase() !== "refunded") {
      return res
        .status(403)
        .json({ message: "Cannot modify completed invoice (except refund)" });
    }

    // Update invoice status
    invoice.status = status.toLowerCase();

    // Optional: update payment status if provided
    if (paymentStatus) {
      invoice.paymentStatus = paymentStatus;
    }

    // Append notes with timestamp
    if (notes) {
      invoice.notes =
        (invoice.notes || "") + `\n${new Date().toISOString()} - ${notes}`;
    }

    // Special logic: When invoice is "completed" or "paid" → complete all related orders
    if (["completed", "paid"].includes(status.toLowerCase())) {
      if (invoice.orders && invoice.orders.length > 0) {
        await Order.updateMany(
          { _id: { $in: invoice.orders } },
          {
            $set: {
              status: "Completed",
              paymentStatus: "Paid",
              updatedAt: new Date(),
            },
          },
        );

        console.log(
          `Completed ${invoice.orders.length} orders for invoice ${id}`,
        );
      }
    }

    // Optional: Handle cancellation/refund (revert orders if needed)
    if (["cancelled", "refunded"].includes(status.toLowerCase())) {
      if (invoice.orders && invoice.orders.length > 0) {
        await Order.updateMany(
          { _id: { $in: invoice.orders } },
          {
            $set: {
              status: "Cancelled",
              updatedAt: new Date(),
            },
          },
        );

        console.log(
          `Cancelled ${invoice.orders.length} orders for invoice ${id}`,
        );
      }
    }

    // Save updated invoice
    const updatedInvoice = await invoice.save();

    // Return success response
    res.status(200).json({
      success: true,
      message: `Invoice status updated to ${status}`,
      data: updatedInvoice,
    });
  } catch (err) {
    console.error("updateInvoiceStatus error:", {
      message: err.message,
      stack: err.stack,
    });

    res.status(500).json({
      success: false,
      message: "Failed to update invoice status",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};
