// ─── controllers/invoiceController.js ────────────────────────────────────────
import  Invoice  from "../models/invoiceModel.js";
// import invoiceModel from "../models/invoiceModel.js";
import { Order }   from "../models/Order.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import { io }      from "../server.js";

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
    const restaurant = await RestaurantProfile.findOne();
    const taxRate    = (restaurant?.gstRate || 0) / 100;
    
    const tax     =Math.round(subtotal * taxRate);
    const total   = subtotal + tax;

    const safeUserId = userId && userId !== "guest" ? userId : null;

    const invoice = await Invoice.create({
      orders:  orders || [],
      user:    safeUserId,
      isGuest: isGuest || false,
      items:   safeItems,
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

    // Update status first
    await Invoice.findByIdAndUpdate(id, {
      status,
      paymentStatus: status === "completed" ? "Paid" : "Pending",
    });

    // Re-fetch fresh so items, tableNo, subtotal etc. are all guaranteed present
    const invoice = await Invoice.findById(id).lean();

    if (!invoice)
      return res.status(404).json({ message: "Invoice not found" });

    if (status === "completed") {

      // Mark all linked orders as Completed
      await Order.updateMany(
        { _id: { $in: invoice.orders } },
        { status: "Completed", paymentStatus: "Paid" }
      );

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