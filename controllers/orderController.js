import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import { io } from "../server.js";
import { isServiceChargeExempt } from "../utils/serviceCharge.js";
// import { RestaurantProfile } from "../models/RestaurantProfile.js";

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
// export const placeOrder = async (req, res) => {
//   const { items, orderType, tableNo, orderId, isGuest } = req.body;
//   console.log("dd",items, orderType, tableNo, orderId, isGuest);
  

//   if (!items?.length)
//     return res.status(400).json({ message: "No items in order" });

//   // Verify prices from DB
//   const dbItems = await Promise.all(
//     items.map(async (i) => {
//       const m = await MenuItem.findById(i.menuItemId);
//       // if (!m || !m.isAvailable) throw new Error(`${i.name} is not available`);
//       if (!m) {
//   throw new Error(`Item not found. Please refresh the menu.`);
// }
// if (!m.isAvailable) {
//   throw new Error(`"${m.name}" is currently not available`);  
//   //               ↑ use m.name (from DB) not i.name (from request)
// }

//       return {
//         menuItem: m._id,
//         name: m.name,
//         price: m.price,
//         qty: i.qty,
//       };
//     }),
//   );

//   const subtotal = dbItems.reduce((s, i) => s + i.price * i.qty, 0);
//   // const tax = Math.round(subtotal * 0.18);
//   const restaurant = await RestaurantProfile.findOne();
// const tax = Math.round(
//   subtotal * ((restaurant?.gstRate || 0) / 100)
// );
  
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
//     tableNo,
//     status: "Placed", // ⭐ IMPORTANT
//     cancelDeadline,
//   });

//   // 🔥 AUTO CHANGE STATUS AFTER 3 MINUTES
//   setTimeout(
//     async () => {
//       try {
//         const current = await Order.findById(order._id);

//         // Only update if still Placed (not cancelled)
//         if (current && current.status === "Placed") {
//           await Order.findByIdAndUpdate(order._id, {
//             status: "Preparing",
//           });

//           console.log(`Order ${order._id} → Preparing`);
//         }
//       } catch (err) {
//         console.error("Auto status update failed:", err);
//       }
//     },
//     3 * 60 * 1000,
//   ); // 3 minutes



//  console.log("EMITTING ORDER");

// io.emit("new-order", order);

//   res.status(201).json(order);
// };
const ALLOWED_PAYMENT_METHODS = ["Cash", "Online"];
const ALLOWED_PAYMENT_STATUSES = ["Pending", "Paid", "Failed"];

// Orders placed by staff themselves (Admin's Create Order modal, Waiter's
// Cart) skip the customer-confirmation step entirely and start straight at
// "Preparing" (see initialStatus below) — only a Client (customer) order
// needs Admin/Waiter to accept/decline it first, starting at
// "PendingConfirmation". Sent as `orderSource` in the placeOrder payload;
// unrecognized/absent values are treated as "client" (the safe default — an
// order only skips confirmation if a caller explicitly identifies itself as
// staff).
const ORDER_SOURCES_SKIP_CONFIRMATION = ["admin", "waiter"];

// Auto-transitions a client order from "Placed" to "Preparing" 3 minutes
// after staff accept it, which is also when the KOT-print trigger fires (see
// "new-order" handler in restaurant-print-service/index.js). Only used by
// acceptOrder now — Admin/Waiter orders (see ORDER_SOURCES_SKIP_CONFIRMATION
// above) start directly at "Preparing" and print their KOT immediately
// instead of going through this delay.
const scheduleAutoPreparing = (orderId) => {
  setTimeout(async () => {
    try {
      const current = await Order.findById(orderId);
      if (current && current.status === "Placed") {
        const preparing = await Order.findByIdAndUpdate(
          orderId,
          { status: "Preparing" },
          { new: true }
        );
        console.log(`Order ${orderId} → Preparing`);
        io.emit("new-order", preparing); // triggers KOT print
        io.emit("order-status-updated", preparing);
      }
    } catch (err) {
      console.error("Auto Preparing update failed:", err);
    }
  }, 3 * 60 * 1000);
};

export const placeOrder = async (req, res) => {
  const { items, orderType, tableNo, orderId, isGuest, deliveryAddress, deliveryPhone, paymentMethod, paymentStatus, chefId, waiterName, orderSource } = req.body;

  if (!items?.length)
    return res.status(400).json({ message: "No items in order" });

  const type = orderType || "Dining";

  if (type === "Delivery" && !String(deliveryAddress || "").trim())
    return res.status(400).json({ message: "Delivery address is required" });

  // Payment method: Cash or Online only (payment-type selection, not a
  // payment gateway — see utils/serviceCharge.js-style validation pattern).
  // A caller that hasn't been updated to send one yet (e.g. the client
  // reorder flow) still works — it just gets the safe "Cash" default;
  // an explicitly invalid value is rejected outright.
  let resolvedPaymentMethod = "Cash";
  if (paymentMethod !== undefined && paymentMethod !== null && paymentMethod !== "") {
    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod))
      return res.status(400).json({ message: "paymentMethod must be either Cash or Online" });
    resolvedPaymentMethod = paymentMethod;
  }

  // Payment status at placement time — e.g. Waiter marking a cash order
  // already paid at the table. Defaults to the schema default ("Pending" /
  // "Unpaid" in the UI) when not sent, same backward-compatible pattern as
  // paymentMethod above.
  let resolvedPaymentStatus = "Pending";
  if (paymentStatus !== undefined && paymentStatus !== null && paymentStatus !== "") {
    if (!ALLOWED_PAYMENT_STATUSES.includes(paymentStatus))
      return res.status(400).json({ message: "paymentStatus must be Pending, Paid, or Failed" });
    resolvedPaymentStatus = paymentStatus;
  }

  try {
    // One batched MenuItem lookup instead of one findById() per cart item
    // (was N sequential-ish round trips for an N-item order), run in
    // parallel with the independent restaurant-settings fetch.
    const menuItemIds = items.map((i) => i.menuItemId);
    const [menuDocs, restaurant] = await Promise.all([
      MenuItem.find({ _id: { $in: menuItemIds } }),
      // Sorted so this always agrees with profileController's singleton pick
      // (see SINGLETON_SORT comment there) if more than one profile doc exists.
      RestaurantProfile.findOne().sort({ createdAt: 1 }),
    ]);
    const menuById = new Map(menuDocs.map((m) => [String(m._id), m]));

    const dbItems = items.map((i) => {
      const m = menuById.get(String(i.menuItemId));
      if (!m) throw new Error(`Item not found. Please refresh the menu.`);
      if (!m.isAvailable) throw new Error(`"${m.name}" is currently not available`);
      return {
        menuItem: m._id, name: m.name, price: m.price, qty: i.qty, category: m.category,
        notes: i.notes ? String(i.notes).trim().slice(0, 200) : undefined,
      };
    });
    const gstRate         = (restaurant?.gstRate || 0) / 100;
    const serviceCharge   = restaurant?.serviceCharge || 0; // flat per-item charge

    const subtotal = dbItems.reduce((s, i) => s + i.price * i.qty, 0);

    if (type === "Delivery") {
      if (restaurant?.services?.delivery === false)
        return res.status(400).json({ message: "Delivery is not available right now" });
      const minOrder = restaurant?.minOrderAmount || 0;
      if (minOrder > 0 && subtotal < minOrder)
        return res.status(400).json({ message: `Minimum order for delivery is ₹${minOrder}` });
    }

    const tax      = Math.round(subtotal * gstRate);

    // ── Service charge: serviceCharge × chargeable quantity ───────────────
    // Parcel / Water / Gas items are exempt (see utils/serviceCharge.js).
    // e.g. 5 chargeable items ordered × ₹4 = ₹20
    const totalQty         = dbItems
      .filter((i) => !isServiceChargeExempt(i.category))
      .reduce((s, i) => s + i.qty, 0);
    const serviceChargeAmt = serviceCharge * totalQty;

    // ── Delivery fee: flat RestaurantProfile.deliveryBaseFee, waived at/above
    // freeDeliveryAbove. Only applies to Delivery orders.
    const freeDeliveryAbove = restaurant?.freeDeliveryAbove || 0;
    const deliveryFee = type === "Delivery"
      ? (freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove ? 0 : (restaurant?.deliveryBaseFee || 0))
      : 0;

    // const discount = subtotal > 400 ? 10 : 0;
    const total    = subtotal + tax + serviceChargeAmt + deliveryFee;

    const cancelDeadline = new Date(Date.now() + 3 * 60 * 1000);

    const skipConfirmation = ORDER_SOURCES_SKIP_CONFIRMATION.includes(String(orderSource || "").toLowerCase());
    const initialStatus = skipConfirmation ? "Preparing" : "PendingConfirmation";

    const order = await Order.create({
      orderId: orderId || undefined,
      user: req.user ? req.user._id : null,
      isGuest: isGuest || false,
      items: dbItems,
      subtotal,
      tax,
      serviceCharge: serviceChargeAmt, // ← store calculated amount
      deliveryFee,
      // discount,
      total,
      orderType: type,
      paymentMethod: resolvedPaymentMethod,
      paymentStatus: resolvedPaymentStatus,
      // Only Waiter's CartPage sends these (see Waiter-wise daily revenue,
      // adminController.getChefRevenue) — undefined for Admin/Client orders.
      chefId: chefId || undefined,
      waiterName: waiterName ? String(waiterName).trim().slice(0, 100) : undefined,
      tableNo: type === "Delivery" ? null : tableNo,
      ...(type === "Delivery" && {
        deliveryAddress: String(deliveryAddress).trim(),
        deliveryPhone: deliveryPhone ? String(deliveryPhone).trim() : undefined,
      }),
      status: initialStatus,
      cancelDeadline,
    });

    if (skipConfirmation) {
      // Admin/Waiter placed this themselves — no confirmation needed and no
      // "Placed" holding step either. Starts directly at "Preparing", so the
      // KOT prints immediately instead of after the client-order 3-minute
      // delay (see scheduleAutoPreparing above).
      io.emit("new-order", order); // triggers KOT print
      io.emit("order-status-updated", order);
    } else {
      // Notify admin/Waiter of a new request awaiting confirmation. This
      // does NOT trigger KOT printing — printing starts only once staff
      // accept the order (see acceptOrder below), which is when
      // "new-order" now fires.
      io.emit("order-request", order);
    }

    res.status(201).json(order);

  } catch (err) {
    console.error("placeOrder error:", err.message);
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/orders/:id/accept — admin or Waiter confirms a pending request.
// Whoever accepts first wins; a second accept/decline on an already-resolved
// order is rejected rather than silently reprocessed.
export const acceptOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "PendingConfirmation")
      return res.status(400).json({ message: `Order is already ${order.status}` });

    order.status = "Placed";
    await order.save();

    // KOT printing no longer happens here — it now fires when the order
    // actually reaches "Preparing" (see scheduleAutoPreparing above, and
    // adminController.updateOrderStatus for the manual-status-change path).
    io.emit("order-status-updated", order);
    scheduleAutoPreparing(order._id);

    res.json(order);
  } catch (err) {
    console.error("acceptOrder error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// PUT /api/orders/:id/decline — admin or Waiter declines a pending request
// (e.g. item unavailable, kitchen too busy).
export const declineOrder = async (req, res) => {
  try {
    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "PendingConfirmation")
      return res.status(400).json({ message: `Order is already ${order.status}` });

    order.status = "Cancelled";
    order.declineReason = reason || "Declined by staff";
    await order.save();

    io.emit("order-status-updated", order);

    res.json(order);
  } catch (err) {
    console.error("declineOrder error:", err.message);
    res.status(500).json({ message: err.message });
  }
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
  if (!["PendingConfirmation", "Placed"].includes(order.status))
    return res.status(400).json({ message: "Cannot cancel this order" });
  if (new Date() > order.cancelDeadline)
    return res.status(400).json({ message: "Cancel window expired" });
  order.status = "Cancelled";
  await order.save();
  io.emit("order-status-updated", order);
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
