// ─── routes/authRoutes.js ────────────────────────────────────────────────────
import express from "express";
import {
  sendOTP,
  verifyOTP,
  getProfile,
  updateProfile,
  updateVegMode,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.patch("/veg-mode", protect, updateVegMode);

export default router;
