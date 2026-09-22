// ─── controllers/invoiceController.js ────────────────────────────────────────
import  Invoice  from "../models/invoiceModel.js";
// import invoiceModel from "../models/invoiceModel.js";
import { Order }   from "../models/Order.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import { io }      from "../server.js";
import { isServiceChargeApplicable, getApplicableCategoryNames } from "../utils/serviceCharge.js";

// ── Generate Invoice ──────────────────────────────────────────────────────────
export const generateInvoice = async (req, res) => {
  try {
    const { orders, items, userId, isGuest, tableNo } = req.body;
    console.log("tableNo", tableNo);

    const safeItems = items || [];

    const subtotal = safeItems.reduce(
      (sum, i) => sum + (i.price || 0) * (i.qty || 0),
      0,
    );

    // ✅ FIXED — read from DB instead of hardcoded 0.18
    // Restaurant settings and the linked-orders lookup (used for service
    // charge/delivery fee below) are independent — run in parallel instead
    // of one after the other.
    // Sorted so this always agrees with profileController's singleton pick
    // (see SINGLETON_SORT comment there) if more than one profile doc exists.
    const [restaurant, linkedOrders] = await Promise.all([
      RestaurantProfile.findOne().sort({ createdAt: 1 }).populate("serviceChargeCategories", "name"),
      orders?.length
        ? Order.find({ _id: { $in: orders } }).select("serviceCharge deliveryFee")
        : Promise.resolve(null),
    ]);
    const taxRate = (restaurant?.gstRate || 0) / 100;
    const tax     = Math.round(subtotal * taxRate);

    // Service charge: prefer summing the amount already computed & stored on
    // each linked Order at placement time (which already applies the
    // Admin-selected category allowlist — see utils/serviceCharge.js) so
    // this stays in sync with orderController.placeOrder without
    // recomputing rates. Falls back to a fresh calculation from the raw
    // item list when no orders are linked (e.g. a direct item-only
    // invoice).
    // Delivery fee, same "sum from linked Orders" approach as service charge
    // — stays correct if a Delivery order is ever included in an invoice.
    let serviceCharge;
    let deliveryFee = 0;
    if (linkedOrders) {
      serviceCharge = linkedOrders.reduce((sum, o) => sum + (o.serviceCharge || 0), 0);
      deliveryFee   = linkedOrders.reduce((sum, o) => sum + (o.deliveryFee || 0), 0);
    } else {
      const applicableCategories = getApplicableCategoryNames(restaurant);
      const chargeableQty = safeItems
        .filter((i) => isServiceChargeApplicable(i.category, applicableCategories))
        .reduce((sum, i) => sum + (i.qty || 0), 0);
      serviceCharge = (restaurant?.serviceCharge || 0) * chargeableQty;
    }

    const total   = subtotal + tax + serviceCharge + deliveryFee;

    const safeUserId = userId && userId !== "guest" ? userId : null;

    const invoice = await Invoice.create({
      orders:  orders || [],
      user:    safeUserId,
      isGuest: isGuest || false,
      items:   safeItems,
      subtotal,
      tax,
      serviceCharge,
      deliveryFee,
      total,
      tableNo: tableNo || null,
    });

    res.status(201).json(invoice);
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
};

// ── Get My Invoices ───────────────────────────────────────────────────────────
export const getMyInvoices = async (req, res) => {
  try {
    let invoices;
    if (req.user) {
      invoices = await Invoice.find({ user: req.user._id }).sort({ createdAt: -1 });
    } else {
      invoices = await Invoice.find({ isGuest: true }).sort({ createdAt: -1 });
    }
    res.json(invoices);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoices" });
  }
};

// ── Get Invoice By ID ─────────────────────────────────────────────────────────
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoice" });
  }
};

// ── Get All Invoices for Admin ────────────────────────────────────────────────
export const getAllInvoices = async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const [invoices, total] = await Promise.all([
      Invoice.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit))
        .populate("orders", "orderId status tableNo total")
        .lean(),
      Invoice.countDocuments(),
    ]);
    res.json({ invoices, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Update Invoice Status ─────────────────────────────────────────────────────
// Called when waiter clicks "Print Bill"
// Step 1: update invoice status in DB
// Step 2: mark all linked orders as Completed
// Step 3: emit bill-print socket → print service on PC prints thermal receipt
export const updateInvoiceStatus = async (req, res) => {
  console.log("🔵 updateInvoiceStatus called", req.params, req.body); 
  try {
    const { id }     = req.params;
    // const { status } = req.body;
    // AFTER — read printerName from frontend
const { status, printerName } = req.body;

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

      // Mark all linked orders as Completed, and read the rate this
      // invoice's serviceCharge amount was actually computed at (a flat
      // per-item amount, not a percentage — printed alongside the amount
      // on the bill) — independent of each other, so run in parallel
      // instead of two sequential round trips.
      const [, profile] = await Promise.all([
        Order.updateMany(
          { _id: { $in: invoice.orders } },
          { status: "Completed", paymentStatus: "Paid" }
        ),
        RestaurantProfile.findOne().sort({ createdAt: 1 }).select("serviceCharge").lean(),
      ]);

      // Build payload for thermal printer
      // const billPayload = {
      //   type:      "BILL",
      //   invoiceId: invoice._id.toString(),
      //   tableNo:   invoice.tableNo,
      //   items:     invoice.items   || [],
      //   subtotal:  invoice.subtotal,
      //   tax:       invoice.tax,
      //   total:     invoice.total,
      //   waiterName: "",
      //   cafeName:  "ADDA CAFE",
      //   printedAt: new Date().toISOString(),
      // };
      // AFTER
const billPayload = {
  type:      "BILL",
  invoiceId: invoice._id.toString(),
  tableNo:   invoice.tableNo,
  items:     invoice.items   || [],
  subtotal:  invoice.subtotal,
  tax:       invoice.tax,
  serviceCharge: invoice.serviceCharge || 0,
  serviceChargeRate: profile?.serviceCharge || 0,
  total:     invoice.total,
  waiterName: "",
  cafeName:  "ADDA CAFE",
  billPrinter: printerName || "Mocktail",   // ← ADD THIS
  printedAt: new Date().toISOString(),
};

      console.log(`🖨️  bill-print emitted → T${invoice.tableNo}  items: ${billPayload.items.length}  total: ${billPayload.total}`);
      io.emit("bill-print", billPayload);
    }

    res.json({ message: "Invoice updated", invoice });
  } catch (err) {
    console.error("updateInvoiceStatus error:", err);
    res.status(500).json({ message: err.message });
  }
};