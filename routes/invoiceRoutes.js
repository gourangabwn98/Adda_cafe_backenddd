import express from "express";
import {
  generateInvoice,
  getMyInvoices,
  getAllInvoices,
  updateInvoiceStatus,
} from "../controllers/invoiceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { getInvoiceById } from "../controllers/invoiceController.js";

const router = express.Router();

router.post("/generate", generateInvoice);
router.get("/my", protect, getMyInvoices);
router.get("/:id", protect, getInvoiceById);
// Admin only routes
router.get("/all", protect, getAllInvoices);
router.patch("/:id/status", protect, updateInvoiceStatus);

export default router;
