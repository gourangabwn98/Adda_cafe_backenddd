import express from "express";
import {
  generateInvoice,
  getMyInvoices,
} from "../controllers/invoiceController.js";
import { protect } from "../middleware/authMiddleware.js";
import { getInvoiceById } from "../controllers/invoiceController.js";

const router = express.Router();

router.post("/generate", generateInvoice);
router.get("/my", protect, getMyInvoices);
router.get("/:id", getInvoiceById);

export default router;
