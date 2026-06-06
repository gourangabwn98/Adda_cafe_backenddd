// import express from "express";
// import {
//   generateInvoice,
//   getMyInvoices,
// } from "../controllers/invoiceController.js";
// import { protect } from "../middleware/authMiddleware.js";
// import { getInvoiceById } from "../controllers/invoiceController.js";

// const router = express.Router();

// router.post("/generate", generateInvoice);
// router.get("/my", protect, getMyInvoices);
// router.get("/:id", getInvoiceById);

// export default router;
// ─── routes/invoiceRoutes.js ──────────────────────────────────────────────────
import express from "express";
import {
  generateInvoice,
  getMyInvoices,
  getInvoiceById,
  getAllInvoices,
  updateInvoiceStatus,   // ← NEW
} from "../controllers/invoiceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post  ("/generate",    protect, generateInvoice);
router.get   ("/my",          protect, getMyInvoices);
router.get   ("/",            protect, getAllInvoices);
router.get   ("/:id",                  getInvoiceById);
router.patch ("/:id/status",  protect, updateInvoiceStatus);  // ← NEW

export default router;