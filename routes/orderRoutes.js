// ─── routes/orderRoutes.js ───────────────────────────────────────────────────
import express from "express";
import {
  placeOrder,
  getMyOrders,
  getOrderById,
  cancelOrder,
  updatePayment,
  rateOrder,
  changeOrderType,
} from "../controllers/orderController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", protect, placeOrder);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getOrderById);
router.patch("/change-type/:orderId", changeOrderType);
router.put("/:id/cancel", protect, cancelOrder);
router.put("/:id/pay", protect, updatePayment);
router.put("/:id/rate", protect, rateOrder);

export default router;
