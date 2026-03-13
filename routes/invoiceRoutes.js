import express from "express";
import {
  generateInvoice,
  getMyInvoices,
} from "../controllers/invoiceController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate", generateInvoice);
router.get("/my", protect, getMyInvoices);

export default router;
