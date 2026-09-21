// ─── controllers/adminController.js ─────────────────────────────────────────
import { User } from "../models/User.js";
import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";
import Invoice from "../models/invoiceModel.js";
import { io }      from "../server.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
// import { RestaurantProfile } from "../models/restaurantProfile.js";

export const generateInvoice = async (req, res) => {
  // const profileDoc = await RestaurantProfile.findOne().lean();
  // const taxRate = ((profileDoc?.gstRate ?? 18) / 100);
   const profileDoc = await RestaurantProfile.findOne().lean();
   console.log("profileDoc",profileDoc);
   
  const taxRate = ((profileDoc?.gstRate ?? 18) / 100);
  console.log("taxrate",taxRate);
  
  // rest unchanged
};

// GET /api/admin/dashboard
export const getDashboardStats = async (req, res) => {
  // TEMPORARY — remove once you've captured before/after numbers in your
  // Render logs. Measures only this handler's own DB + serialization work.
  console.time("[perf] getDashboardStats");
  try {
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));

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
      // Completed + Paid revenue — the definition the admin dashboard's
      // "Total revenue" / "Today's revenue" cards actually use (see
      // DashboardPage.jsx completedPaidAll/completedPaidToday). Added
      // alongside the existing paymentStatus-only revenueAgg/todayOrdersAgg
      // (still used by AnalyticsPage) rather than changing their $match, so
      // AnalyticsPage's displayed numbers don't shift.
      completedRevenueAgg,
      completedTodayAgg,
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
            createdAt: { $gte: startOfToday, $lte: endOfToday },
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

      Order.aggregate([
        { $match: { status: "Completed", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),

      Order.aggregate([
        {
          $match: {
            status: "Completed",
            paymentStatus: "Paid",
            createdAt: { $gte: startOfToday, $lte: endOfToday },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" }, count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      stats: {
        totalUsers,
        totalItems,
        totalOrders,
        totalInvoices,
        totalRevenue: revenueAgg[0]?.total || 0,
        todayOrders: todayOrdersAgg[0]?.count || 0,
        todayRevenue: todayOrdersAgg[0]?.revenue || 0,
        completedRevenue: completedRevenueAgg[0]?.total || 0,
        completedTodayRevenue: completedTodayAgg[0]?.total || 0,
        completedTodayCount: completedTodayAgg[0]?.count || 0,
      },
      ordersByStatus,
      recentOrders,
      topItems,
      weeklyRevenue,
    });
    console.timeEnd("[perf] getDashboardStats"); // TEMPORARY
  } catch (err) {
    console.timeEnd("[perf] getDashboardStats"); // TEMPORARY
    console.error(err);
    res.status(500).json({ message: "Dashboard error" });
  }
};

// GET /api/admin/orders  (all orders, paginated)
// Shared by getAllOrders/getOrdersSummary — builds the same Mongo filter
// from the same set of optional query params so the paginated list and its
// stat pills always agree on what "matches the current filters" means.
// `startDate`/`endDate` are "YYYY-MM-DD" (see OrdersPage.jsx date inputs).
async function buildOrderFilter({ status, orderType, paymentStatus, search, startDate, endDate }) {
  const filter = {};
  if (status && status !== "All") {
    // Comma-separated list ("Placed,Preparing,Ready,Delivered") → $in — used
    // by TablesPage to ask for "active" orders directly instead of fetching
    // everything and filtering out Completed/Cancelled/PendingConfirmation
    // in the browser. A single value behaves exactly as before.
    const statuses = String(status).split(",").map((s) => s.trim()).filter(Boolean);
    filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
  }
  if (orderType && orderType !== "All") filter.orderType = orderType;
  if (paymentStatus && paymentStatus !== "All") filter.paymentStatus = paymentStatus;
  if (search) {
    // orderId lives on the order itself, but customer name/phone live on the
    // referenced User doc — Mongo can't regex-match a populated ref field
    // directly, so matching users have to be looked up first (see
    // OrdersPage.jsx search placeholder: "Search order ID, customer or phone").
    const matchingUsers = await User.find(
      {
        $or: [
          { name: { $regex: search, $options: "i" } },
          { phone: { $regex: search, $options: "i" } },
        ],
      },
      "_id",
    );
    filter.$or = [
      { orderId: { $regex: search, $options: "i" } },
      { user: { $in: matchingUsers.map((u) => u._id) } },
    ];
  }
  if (startDate || endDate) {
    // startDate/endDate are "YYYY-MM-DD" local calendar dates (e.g.
    // DashboardPage.jsx todayStr(), OrdersPage.jsx date pickers) for this
    // India-based restaurant — anchor to IST (UTC+05:30) midnight, not UTC
    // midnight. Parsing as "...Z" shifted the whole window 5:30 forward, so
    // "today" queries returned nothing until 5:30 AM IST (orders placed
    // between local midnight and 5:30 AM fell into the previous UTC day).
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`);
    if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
  }
  return filter;
}

export const getAllOrders = async (req, res) => {
  // TEMPORARY — remove once you've captured before/after numbers.
  const label = `[perf] getAllOrders limit=${req.query.limit || 20}`;
  console.time(label);
  try {
    const { page = 1, limit = 20, status, orderType, paymentStatus, search, startDate, endDate } = req.query;
    const filter = await buildOrderFilter({ status, orderType, paymentStatus, search, startDate, endDate });

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("user", "name phone"),
      Order.countDocuments(filter),
    ]);
    const payload = {
      orders,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
    res.json(payload);
    console.timeEnd(label); // TEMPORARY
    console.log(`[perf] getAllOrders payload ≈ ${(JSON.stringify(payload).length / 1024).toFixed(1)} KB, ${orders.length} orders`); // TEMPORARY
  } catch (err) {
    console.timeEnd(label); // TEMPORARY
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/orders/summary
// Aggregation-only counterpart to getAllOrders — the Orders page's stat
// pills (Total/Today/Collected/Active), per-status filter-chip counts, and
// the date-range pill previously came from summing the entire fetched order
// list in the browser (see OrdersPage.jsx `stats`/`rangeStats`, pre-fix).
// This computes the same numbers in the database instead, so the page no
// longer needs to download every order just to show a few totals.
export const getOrdersSummary = async (req, res) => {
  try {
    const { orderType, search, startDate, endDate } = req.query;
    const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
    const endOfToday = new Date(new Date().setHours(23, 59, 59, 999));

    // Date-range pill: Completed + Paid orders in [startDate, endDate],
    // still respecting the Type/search filters (Status/Payment dropdowns are
    // intentionally not applied here — they'd contradict the hardcoded
    // Completed+Paid requirement and always zero the pill out).
    const rangeFilter = await buildOrderFilter({ orderType, search, startDate, endDate });
    rangeFilter.status = "Completed";
    rangeFilter.paymentStatus = "Paid";

    const [
      total,
      today,
      revenueAgg,
      pending,
      byStatusAgg,
      rangeCount,
      rangeAmountAgg,
    ] = await Promise.all([
      Order.countDocuments({}),
      Order.countDocuments({ createdAt: { $gte: startOfToday, $lte: endOfToday } }),
      Order.aggregate([
        { $match: { status: "Completed", paymentStatus: "Paid" } },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
      Order.countDocuments({ status: { $in: ["Placed", "Preparing", "Ready"] } }),
      Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Order.countDocuments(rangeFilter),
      Order.aggregate([
        { $match: rangeFilter },
        { $group: { _id: null, total: { $sum: "$total" } } },
      ]),
    ]);

    const byStatus = {};
    byStatusAgg.forEach((s) => { byStatus[s._id] = s.count; });

    res.json({
      total,
      today,
      revenue: revenueAgg[0]?.total || 0,
      pending,
      byStatus,
      rangeCount,
      rangeAmount: rangeAmountAgg[0]?.total || 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/admin/orders/:id/status
// Accepts `status` (unchanged, existing behavior) and, optionally,
// `paymentStatus` and/or `paymentMethod` so admin can correct either after
// the order was already placed — e.g. a "Cash" order that was actually paid
// online, or marking an order Paid once cash is collected in person.
export const updateOrderStatus = async (req, res) => {
  try {
    const { status, paymentStatus, paymentMethod } = req.body;
    const update = {};

    if (status !== undefined) update.status = status;

    if (paymentStatus !== undefined) {
      if (!["Pending", "Paid", "Failed"].includes(paymentStatus))
        return res.status(400).json({ message: "paymentStatus must be Pending, Paid, or Failed" });
      update.paymentStatus = paymentStatus;
    }

    if (paymentMethod !== undefined) {
      if (!["Cash", "Online"].includes(paymentMethod))
        return res.status(400).json({ message: "paymentMethod must be either Cash or Online" });
      update.paymentMethod = paymentMethod;
    }

    if (!Object.keys(update).length)
      return res.status(400).json({ message: "Nothing to update" });

    // Read the pre-update status so a manual status change INTO "Preparing"
    // (e.g. Admin/Waiter clicking the "Preparing" button) can also trigger
    // the KOT print exactly once — mirrors the automatic path in
    // orderController.acceptOrder's 3-minute timer. Skipped entirely when
    // this call isn't changing `status` at all (a payment-only update).
    const wasPreparingAlready =
      update.status === "Preparing"
        ? (await Order.findById(req.params.id).select("status"))?.status === "Preparing"
        : null;

    const order = await Order.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (update.status === "Preparing" && !wasPreparingAlready) {
      io.emit("new-order", order); // triggers KOT print — see orderController.acceptOrder
      io.emit("order-status-updated", order);
    }

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

    // Optional date-range filter — additive: no startDate/endDate means
    // "everything", same as before, so existing callers (InvoicesPage,
    // which needs full history) are unaffected. Dashboard/table-status
    // views only need today's invoices to match against active tables, so
    // they can now ask for just that instead of the entire collection.
    //
    // orderIds (comma-separated Order _ids) — TablesPage only needs invoices
    // tied to its small set of currently-active dining orders, regardless of
    // date (an order can span past midnight), so it fetches by exact order
    // id instead of a date window.
    const { startDate, endDate, orderIds } = req.query;
    const filter = {};
    if (startDate || endDate) {
      // Same IST-anchoring fix as adminController.buildOrderFilter — these
      // are local "YYYY-MM-DD" calendar dates, not UTC ones.
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(`${startDate}T00:00:00.000+05:30`);
      if (endDate) filter.createdAt.$lte = new Date(`${endDate}T23:59:59.999+05:30`);
    }
    if (orderIds) {
      const ids = String(orderIds).split(",").map((s) => s.trim()).filter(Boolean);
      filter.orders = { $in: ids };
    }

    const invoices = await Invoice.find(filter)
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
// export const updateInvoiceStatus = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { status, paymentStatus, notes } = req.body;

//     // Allowed invoice statuses
//     const allowedStatuses = [
//       "pending",
//       "completed",
//       "paid",
//       "cancelled",
//       "refunded",
//     ];

//     if (!status || !allowedStatuses.includes(status.toLowerCase())) {
//       return res.status(400).json({
//         message: `Invalid status. Allowed: ${allowedStatuses.join(", ")}`,
//       });
//     }

//     // Find the invoice
//     const invoice = await Invoice.findById(id);

//     if (!invoice) {
//       return res.status(404).json({ message: "Invoice not found" });
//     }

//     // Optional: prevent changing already completed invoices (except refund)
//     if (invoice.status === "completed" && status.toLowerCase() !== "refunded") {
//       return res
//         .status(403)
//         .json({ message: "Cannot modify completed invoice (except refund)" });
//     }

//     // Update invoice status
//     invoice.status = status.toLowerCase();

//     // Optional: update payment status if provided
//     if (paymentStatus) {
//       invoice.paymentStatus = paymentStatus;
//     }

//     // Append notes with timestamp
//     if (notes) {
//       invoice.notes =
//         (invoice.notes || "") + `\n${new Date().toISOString()} - ${notes}`;
//     }

//     // Special logic: When invoice is "completed" or "paid" → complete all related orders
//     if (["completed", "paid"].includes(status.toLowerCase())) {
//       if (invoice.orders && invoice.orders.length > 0) {
//         await Order.updateMany(
//           { _id: { $in: invoice.orders } },
//           {
//             $set: {
//               status: "Completed",
//               paymentStatus: "Paid",
//               updatedAt: new Date(),
//             },
//           },
//         );

//         console.log(
//           `Completed ${invoice.orders.length} orders for invoice ${id}`,
//         );
//       }
//     }

//     // Optional: Handle cancellation/refund (revert orders if needed)
//     if (["cancelled", "refunded"].includes(status.toLowerCase())) {
//       if (invoice.orders && invoice.orders.length > 0) {
//         await Order.updateMany(
//           { _id: { $in: invoice.orders } },
//           {
//             $set: {
//               status: "Cancelled",
//               updatedAt: new Date(),
//             },
//           },
//         );

//         console.log(
//           `Cancelled ${invoice.orders.length} orders for invoice ${id}`,
//         );
//       }
//     }

//     // Save updated invoice
//     const updatedInvoice = await invoice.save();

//     // Return success response
//     res.status(200).json({
//       success: true,
//       message: `Invoice status updated to ${status}`,
//       data: updatedInvoice,
//     });
//   } catch (err) {
//     console.error("updateInvoiceStatus error:", {
//       message: err.message,
//       stack: err.stack,
//     });

//     res.status(500).json({
//       success: false,
//       message: "Failed to update invoice status",
//       error: process.env.NODE_ENV === "development" ? err.message : undefined,
//     });
//   }
// };
export const updateInvoiceStatus = async (req, res) => {
  console.log("🔵 updateInvoiceStatus called", req.params, req.body); 
  try {
    const { id }     = req.params;
    const { status,printerName  } = req.body;

    // Update and read back the result in one round trip instead of an
    // update followed by a separate findById to re-fetch the same document.
    const invoice = await Invoice.findByIdAndUpdate(
      id,
      { status, paymentStatus: status === "completed" ? "Paid" : "Pending" },
      { new: true },
    ).lean();

    if (!invoice)
      return res.status(404).json({ message: "Invoice not found" });

    if (status === "completed") {

      // Mark all linked orders as Completed, re-read their paymentMethod
      // (unaffected by the updateMany, but needed for the bill), and fetch
      // restaurant info for the bill heading — three independent operations
      // run in parallel instead of three sequential round trips.
      const [, linkedOrders, profile] = await Promise.all([
        Order.updateMany(
          { _id: { $in: invoice.orders } },
          { status: "Completed", paymentStatus: "Paid" }
        ),
        // paymentMethod isn't touched by the updateMany above (only status/
        // paymentStatus are) — read it back from the linked orders so the
        // printed bill shows what the customer actually chose. Usually all
        // one table's orders share a method; joined as a fallback if they
        // ever differ (mirrors the same pattern used in Waiter's TablesPage
        // merged-bill display).
        Order.find({ _id: { $in: invoice.orders } }).select("paymentMethod").lean(),
        // Restaurant info for the printed bill heading (Admin → Profile →
        // Restaurant Logo/name/address/phone) — read fresh right here so a
        // logo/address change takes effect on the very next bill printed,
        // with no caching or print-service restart involved. Same singleton
        // sort used everywhere else this profile is read (profileController.js).
        RestaurantProfile.findOne().sort({ createdAt: 1 }).lean(),
      ]);
      const billPaymentMethod =
        [...new Set(linkedOrders.map((o) => o.paymentMethod).filter(Boolean))].join(", ") || "Cash";

      // Build payload for thermal printer
      const billPayload = {
        type:      "BILL",
        invoiceId: invoice._id.toString(),
        tableNo:   invoice.tableNo,
        items:     invoice.items   || [],
        subtotal:  invoice.subtotal,
        tax:       invoice.tax,
        serviceCharge: invoice.serviceCharge || 0,
        // Rate this invoice's serviceCharge amount was actually computed
        // at (RestaurantProfile.serviceCharge is a flat per-item amount,
        // not a percentage) — printed alongside the amount on the bill.
        serviceChargeRate: profile?.serviceCharge || 0,
        total:     invoice.total,
        waiterName: "",
        cafeName:  "ADDA CAFE",
        billPrinter: printerName || "Mocktail",
        printedAt: new Date().toISOString(),
        // Payment method/status selection — not a payment gateway. The
        // linked orders were just set to paymentStatus "Paid" above (that's
        // what "completing" a bill means in this system), so the bill
        // reflects that.
        paymentMethod: billPaymentMethod,
        paymentStatus: "Paid",
        restaurant: profile
          ? {
              name: profile.restaurantName,
              logo: profile.logo || undefined,
              address: profile.address || undefined,
              phone: profile.phone || undefined,
            }
          : null,
      };

      console.log(`🖨️  bill-print emitted → T${invoice.tableNo}  items: ${billPayload.items.length}  total: ${billPayload.total}`);
      console.log("🖨️ emitting bill-print");
console.log("Connected sockets:", io.engine.clientsCount);
      io.emit("bill-print", billPayload);
    }

    res.json({ message: "Invoice updated", invoice });
  } catch (err) {
    console.error("updateInvoiceStatus error:", err);
    res.status(500).json({ message: err.message });
  }
};
