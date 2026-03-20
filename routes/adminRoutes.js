// ─── routes/adminRoutes.js ───────────────────────────────────────────────────
import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  getDashboardStats,
  getAllOrders,
  updateOrderStatus,
  getAllUsers,
  deleteUser,
  getAllInvoices,
  updateInvoiceStatus,
} from "../controllers/adminController.js";

const router = express.Router();

// All admin routes are protected (add isAdmin middleware in production)
router.use(protect);

router.get("/dashboard", getDashboardStats);
router.get("/orders", getAllOrders);
router.get("/invoices/all", getAllInvoices);
router.get("/users", getAllUsers);
router.patch("/invoices/:id/status", updateInvoiceStatus);
router.put("/orders/:id/status", updateOrderStatus);

router.delete("/users/:id", deleteUser);

export default router;
