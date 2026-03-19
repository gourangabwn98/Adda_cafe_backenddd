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
