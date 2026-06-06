// ─── controllers/invoiceController.js ────────────────────────────────────────
import { Invoice } from "../models/Invoice.js";
import { Order }   from "../models/Order.js";
import { io }      from "../server.js";   // ← your existing exported io

// ── Generate Invoice (YOUR EXISTING CODE — unchanged) ─────────────────────────
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
    const tax     = subtotal * taxRate;
    const total   = subtotal + tax;

    // Fix invalid guest userId
    const safeUserId = userId && userId !== "guest" ? userId : null;

    // In updateInvoiceStatus, change the Invoice query to populate orders with waiterName
const invoice = await Invoice.findByIdAndUpdate(
  id,
  {
    status,
    paymentStatus: status === "completed" ? "Paid" : "Pending",
  },
  { new: true }
).populate("orders", "waiterName tableNo")   // ← add this
.lean();

// Then in the billPayload, add:
const billPayload = {
  type:        "BILL",
  invoiceId:   invoice._id.toString(),
  tableNo:     invoice.tableNo,
  items:       invoice.items || [],
  subtotal:    invoice.subtotal,
  tax:         invoice.tax,
  total:       invoice.total,
  waiterName:  invoice.orders?.[0]?.waiterName || "",   // ← add this line
  cafeName:    "ADDA CAFE",
  printedAt:   new Date().toISOString(),
};

    res.status(201).json(invoice);
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).json({ message: "Failed to generate invoice" });
  }
};

// ── Get My Invoices (YOUR EXISTING CODE — unchanged) ──────────────────────────
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
    res.status(500).json({ message: "Failed to fetch invoicess" });
  }
};

// ── Get Invoice By ID (YOUR EXISTING CODE — unchanged) ────────────────────────
export const getInvoiceById = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    res.json(invoice);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch invoicce" });
  }
};

// ── Get All Invoices for Admin ─────────────────────────────────────────────────
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

// ── Update Invoice Status ← NEW ───────────────────────────────────────────────
// Called when waiter clicks "Print Bill"
// → marks invoice completed → marks orders Completed → emits bill-print socket
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id }     = req.params;
    const { status } = req.body;

    const invoice = await Invoice.findByIdAndUpdate(
      id,
      {
        status,
        paymentStatus: status === "completed" ? "Paid" : "Pending",
      },
      { new: true }
    ).lean();

    if (!invoice)
      return res.status(404).json({ message: "Invoice not found" });

    if (status === "completed") {
      // Mark all linked orders as Completed
      await Order.updateMany(
        { _id: { $in: invoice.orders } },
        { status: "Completed", paymentStatus: "Paid" }
      );

      // Emit to Admin PC print service
      // invoice.items is already saved by generateInvoice — no extra DB call needed
      const billPayload = {
        type:      "BILL",
        invoiceId: invoice._id.toString(),
        tableNo:   invoice.tableNo,
        items:     invoice.items || [],
        subtotal:  invoice.subtotal,
        tax:       invoice.tax,
        total:     invoice.total,
        cafeName:  "ADDA CAFE",
        printedAt: new Date().toISOString(),
      };

      console.log(`🖨️  bill-print emitted → Table T${invoice.tableNo}`);
      io.emit("bill-print", billPayload);
    }

    res.json({ message: "Invoice updated", invoice });
  } catch (err) {
    console.error("updateInvoiceStatus error:", err);
    res.status(500).json({ message: err.message });
  }
};