import express from "express";
import {
  firebaseVerify,
  getProfile,
  updateProfile,
  updateVegMode,
  updateLanguage,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public
router.post("/firebase-verify", firebaseVerify);
router.post("/check-admin-phone", checkAdminPhone);

// Protected
router.get("/profile", protect, getProfile);
router.put("/profile", protect, updateProfile);
router.patch("/veg-mode", protect, updateVegMode);
router.patch("/language", protect, updateLanguage);

export default router;


















