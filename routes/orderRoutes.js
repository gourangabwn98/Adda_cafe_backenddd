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
  getOrderByOrderId,
  acceptOrder,
  declineOrder,
} from "../controllers/orderController.js";
import { optionalProtect, protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/", optionalProtect, placeOrder);
router.get("/my", protect, getMyOrders);
router.get("/:id", protect, getOrderById);
router.get("/by-order-id/:orderId", getOrderByOrderId);
router.patch("/change-type/:orderId", changeOrderType);
router.put("/:id/cancel", protect, cancelOrder);
router.put("/:id/pay", protect, updatePayment);
router.put("/:id/rate", protect, rateOrder);
// Admin/Waiter confirm or decline a PendingConfirmation order request.
router.put("/:id/accept", protect, acceptOrder);
router.put("/:id/decline", protect, declineOrder);

export default router;
