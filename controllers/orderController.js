import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";

// ─── ORDER CONTROLLER ────────────────────────────────────────────────────────

// POST /api/orders
// export const placeOrder = async (req, res) => {
//   // const { items, orderType } = req.body;
//   const { items, orderType, orderId, isGuest } = req.body;
//   console.log(items, orderType);

//   if (!items?.length)
//     return res.status(400).json({ message: "No items in order" });

//   // Verify prices from DB
//   const dbItems = await Promise.all(
//     items.map(async (i) => {
//       const m = await MenuItem.findById(i.menuItemId);
//       if (!m || !m.isAvailable) throw new Error(`${i.name} is not available`);
//       return { menuItem: m._id, name: m.name, price: m.price, qty: i.qty };
//     }),
//   );

//   const subtotal = dbItems.reduce((s, i) => s + i.price * i.qty, 0);
//   const tax = Math.round(subtotal * 0.18);
//   const discount = subtotal > 400 ? 10 : 0;
//   const total = subtotal + tax - discount;
//   const cancelDeadline = new Date(Date.now() + 3 * 60 * 1000); // 3 min

//   const order = await Order.create({
//     orderId: orderId || undefined,
//     user: req.user ? req.user._id : null,
//     isGuest: isGuest || false,
//     items: dbItems,
//     subtotal,
//     tax,
//     discount,
//     total,
//     orderType: orderType || "Dining",
//     cancelDeadline,
//   });
//   res.status(201).json(order);
// };
export const placeOrder = async (req, res) => {
  const { items, orderType, tableNo, orderId, isGuest } = req.body;

  if (!items?.length)
    return res.status(400).json({ message: "No items in order" });

  // Verify prices from DB
  const dbItems = await Promise.all(
    items.map(async (i) => {
      const m = await MenuItem.findById(i.menuItemId);
      if (!m || !m.isAvailable) throw new Error(`${i.name} is not available`);

      return {
        menuItem: m._id,
        name: m.name,
        price: m.price,
        qty: i.qty,
      };
    }),
  );

  const subtotal = dbItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax = Math.round(subtotal * 0.18);
  const discount = subtotal > 400 ? 10 : 0;
  const total = subtotal + tax - discount;

  const cancelDeadline = new Date(Date.now() + 3 * 60 * 1000); // 3 min

  const order = await Order.create({
    orderId: orderId || undefined,
    user: req.user ? req.user._id : null,
    isGuest: isGuest || false,
    items: dbItems,
    subtotal,
    tax,
    discount,
    total,
    orderType: orderType || "Dining",
    tableNo,
    status: "Placed", // ⭐ IMPORTANT
    cancelDeadline,
  });

  // 🔥 AUTO CHANGE STATUS AFTER 3 MINUTES
  setTimeout(
    async () => {
      try {
        const current = await Order.findById(order._id);

        // Only update if still Placed (not cancelled)
        if (current && current.status === "Placed") {
          await Order.findByIdAndUpdate(order._id, {
            status: "Preparing",
          });

          console.log(`Order ${order._id} → Preparing`);
        }
      } catch (err) {
        console.error("Auto status update failed:", err);
      }
    },
    3 * 60 * 1000,
  ); // 3 minutes

  res.status(201).json(order);
};

// GET /api/orders/my
export const getMyOrders = async (req, res) => {
  const orders = await Order.find({ user: req.user._id })
    .sort({ createdAt: -1 })
    .populate("items.menuItem", "name image");
  res.json(orders);
};

// GET /api/orders/:id
export const getOrderById = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  res.json(order);
};

export const getOrderByOrderId = async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });

  if (!order) return res.status(404).json({ message: "Order not found" });

  res.json(order);
};

// Change order type
export const changeOrderType = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { orderType } = req.body;

    if (!["Dining", "Take Away"].includes(orderType)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order type",
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { orderType },
      { new: true },
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    res.json({
      success: true,
      message: "Order type updated successfully",
      data: order,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// PUT /api/orders/:id/cancel
export const cancelOrder = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.status !== "Placed")
    return res.status(400).json({ message: "Cannot cancel this order" });
  if (new Date() > order.cancelDeadline)
    return res.status(400).json({ message: "Cancel window expired" });
  order.status = "Cancelled";
  await order.save();
  res.json({ message: "Order cancelled", order });
};

// PUT /api/orders/:id/pay
export const updatePayment = async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.paymentStatus = "Paid";
  order.status = "Preparing";
  await order.save();
  res.json(order);
};

// PUT /api/orders/:id/rate
export const rateOrder = async (req, res) => {
  const { rating } = req.body;
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  order.rating = rating;
  await order.save();
  res.json({ message: "Rating saved" });
};
