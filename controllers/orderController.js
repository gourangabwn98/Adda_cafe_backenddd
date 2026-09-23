import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";
import { Chef } from "../models/Chef.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import { io } from "../server.js";
import { isServiceChargeApplicable, getApplicableCategoryNames } from "../utils/serviceCharge.js";
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

// Verifies cart items against the DB and computes subtotal/tax/service
// charge/delivery fee/total the same way for every caller that needs it —
// placeOrder (new order) and updateOrderItems (customer modifying a
// still-"Placed" order both need identical, non-duplicated pricing logic so
// the two can never silently diverge.
const computeOrderPricing = async (items, type) => {
  const menuItemIds = items.map((i) => i.menuItemId);
  const [menuDocs, restaurant] = await Promise.all([
    MenuItem.find({ _id: { $in: menuItemIds } }),
    // Sorted so this always agrees with profileController's singleton pick
    // (see SINGLETON_SORT comment there) if more than one profile doc exists.
    // populate() resolves serviceChargeCategories to {_id, name} so
    // isServiceChargeApplicable can match against item.category by name.
    RestaurantProfile.findOne().sort({ createdAt: 1 }).populate("serviceChargeCategories", "name"),
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
  const gstRate       = (restaurant?.gstRate || 0) / 100;
  const serviceCharge = restaurant?.serviceCharge || 0; // flat per-item charge

  const subtotal = dbItems.reduce((s, i) => s + i.price * i.qty, 0);
  const tax      = Math.round(subtotal * gstRate);

  // ── Service charge: serviceCharge × chargeable quantity ───────────────
  // Only categories the Admin selected in Profile → Pricing & delivery
  // incur this charge (see utils/serviceCharge.js) — everything else is
  // exempt by default.
  // e.g. 5 chargeable items ordered × ₹4 = ₹20
  const applicableCategories = getApplicableCategoryNames(restaurant);
  const totalQty         = dbItems
    .filter((i) => isServiceChargeApplicable(i.category, applicableCategories))
    .reduce((s, i) => s + i.qty, 0);
  const serviceChargeAmt = serviceCharge * totalQty;

  // ── Delivery fee: flat RestaurantProfile.deliveryBaseFee, waived at/above
  // freeDeliveryAbove. Only applies to Delivery orders.
  const freeDeliveryAbove = restaurant?.freeDeliveryAbove || 0;
  const deliveryFee = type === "Delivery"
    ? (freeDeliveryAbove > 0 && subtotal >= freeDeliveryAbove ? 0 : (restaurant?.deliveryBaseFee || 0))
    : 0;

  const total = subtotal + tax + serviceChargeAmt + deliveryFee;

  return { dbItems, subtotal, tax, serviceChargeAmt, deliveryFee, total, restaurant };
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
    const { dbItems, subtotal, tax, serviceChargeAmt, deliveryFee, total, restaurant } =
      await computeOrderPricing(items, type);

    if (type === "Delivery") {
      if (restaurant?.services?.delivery === false)
        return res.status(400).json({ message: "Delivery is not available right now" });
      const minOrder = restaurant?.minOrderAmount || 0;
      if (minOrder > 0 && subtotal < minOrder)
        return res.status(400).json({ message: `Minimum order for delivery is ₹${minOrder}` });
    }

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
//
// The accepting waiter becomes the order's assigned waiter (Order.chefId /
// waiterName), which is what getChefRevenue groups collection by. Resolved
// server-side from the verified login phone (Waiter login = Chef phone +
// OTP), never from the request body. An accept by a non-waiter (e.g. Admin)
// leaves the order unassigned so it's in nobody's collection.
export const acceptOrder = async (req, res) => {
  try {
    const chef = req.user?.phone
      ? await Chef.findOne({ phone: req.user.phone }).select("name").lean()
      : null;

    // Atomic status check + update: two waiters accepting at the same
    // instant can't both succeed and overwrite each other's assignment.
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "PendingConfirmation" },
      {
        $set: {
          status: "Placed",
          // Re-anchor the 3-minute window to THIS moment, not order-creation
          // time — it was originally set in placeOrder, which can be an
          // arbitrary amount of time before staff actually accept. Customers
          // see this deadline as their "modify/cancel this order" countdown
          // (see updateOrderItems / cancelOrder below), so it must line up
          // with scheduleAutoPreparing's timer, started below on the same
          // instant.
          cancelDeadline: new Date(Date.now() + 3 * 60 * 1000),
          ...(chef && { chefId: chef._id, waiterName: chef.name }),
        },
        ...(!chef && { $unset: { chefId: 1, waiterName: 1 } }),
      },
      { new: true },
    );
    if (!order) {
      const existing = await Order.findById(req.params.id).select("status");
      if (!existing) return res.status(404).json({ message: "Order not found" });
      return res.status(400).json({ message: `Order is already ${existing.status}` });
    }

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
    // Atomic for the same reason as acceptOrder — a decline racing an accept
    // must not cancel an order another waiter has just been assigned.
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "PendingConfirmation" },
      { $set: { status: "Cancelled", declineReason: reason || "Declined by staff" } },
      { new: true },
    );
    if (!order) {
      const existing = await Order.findById(req.params.id).select("status");
      if (!existing) return res.status(404).json({ message: "Order not found" });
      return res.status(400).json({ message: `Order is already ${existing.status}` });
    }

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

// PUT /api/orders/:id/items — customer adds/removes items or changes
// quantities on their own order while it's "Placed" and still inside the
// same 3-minute window as cancelOrder above (see acceptOrder, which anchors
// cancelDeadline to the moment the order became "Placed"). Once the order
// moves to "Preparing" (or the deadline passes) this is rejected, matching
// "Disable all customer modifications" once the window expires.
export const updateOrderItems = async (req, res) => {
  const { items } = req.body;
  if (!items?.length)
    return res.status(400).json({ message: "No items in order" });

  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (order.status !== "Placed")
    return res.status(400).json({ message: "This order can no longer be modified" });
  if (!order.cancelDeadline || new Date() > order.cancelDeadline)
    return res.status(400).json({ message: "Modify window expired" });

  try {
    const { dbItems, subtotal, tax, serviceChargeAmt, deliveryFee, total, restaurant } =
      await computeOrderPricing(items, order.orderType);

    if (order.orderType === "Delivery") {
      const minOrder = restaurant?.minOrderAmount || 0;
      if (minOrder > 0 && subtotal < minOrder)
        return res.status(400).json({ message: `Minimum order for delivery is ₹${minOrder}` });
    }

    order.items = dbItems;
    order.subtotal = subtotal;
    order.tax = tax;
    order.serviceCharge = serviceChargeAmt;
    order.deliveryFee = deliveryFee;
    order.total = total;
    await order.save();

    io.emit("order-status-updated", order);
    res.json(order);
  } catch (err) {
    console.error("updateOrderItems error:", err.message);
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/admin/orders/:id/items — Admin modifies an existing order's
// items (add/remove/change qty). Unlike the customer path above, there's
// no ownership check (Admin can act on any table's order) and no
// cancelDeadline window — instead, Admin may modify any order whose
// status is exactly "Placed" or "Preparing"; every other status is
// rejected with 400. Route-level `requireAdmin` (see routes/adminRoutes.js)
// enforces the caller is an actual Admin account, not just any logged-in
// user — never rely on the frontend hiding the button.
// Reuses computeOrderPricing — the exact same subtotal/tax/service-charge/
// total calculation used by placeOrder and the customer's updateOrderItems
// above — so Admin edits can never diverge from that single source of
// truth (service charge in particular already reflects whatever
// categories are currently selected in Admin → Profile → Pricing).
const MODIFIABLE_STATUSES = ["Placed", "Preparing"];
export const adminUpdateOrderItems = async (req, res) => {
  const { items } = req.body;
  if (!items?.length)
    return res.status(400).json({ message: "No items in order" });

  const order = await Order.findById(req.params.id);
  if (!order) return res.status(404).json({ message: "Order not found" });
  if (!MODIFIABLE_STATUSES.includes(order.status))
    return res.status(400).json({
      message: `Order cannot be modified while status is "${order.status}" — only Placed or Preparing orders can be modified`,
    });

  try {
    const { dbItems, subtotal, tax, serviceChargeAmt, deliveryFee, total, restaurant } =
      await computeOrderPricing(items, order.orderType);

    if (order.orderType === "Delivery") {
      const minOrder = restaurant?.minOrderAmount || 0;
      if (minOrder > 0 && subtotal < minOrder)
        return res.status(400).json({ message: `Minimum order for delivery is ₹${minOrder}` });
    }

    order.items = dbItems;
    order.subtotal = subtotal;
    order.tax = tax;
    order.serviceCharge = serviceChargeAmt;
    order.deliveryFee = deliveryFee;
    order.total = total;
    await order.save();

    // Same event the customer-modification path already emits — every
    // existing listener (Admin Dashboard, Waiter TablesPage/useOrderAlerts)
    // picks this up unchanged; Kitchen/Customer apps don't use Socket.IO
    // at all today (poll instead), so there's nothing new to wire there.
    io.emit("order-status-updated", order);
    res.json(order);
  } catch (err) {
    console.error("adminUpdateOrderItems error:", err.message);
    res.status(400).json({ message: err.message });
  }
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
