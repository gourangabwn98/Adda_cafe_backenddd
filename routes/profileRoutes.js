// routes/admin/restaurantProfile.routes.js
import express from "express";
import multer from "multer";
const router = express.Router();
// const multer = require("multer");

import {
  getProfile,
  updateProfile,
  uploadLogo,
} from "../controllers/profileController.js";

// const { protect, adminOnly } = require("../../middleware/auth.middleware"); // adjust to your auth middleware

// ── Multer — in-memory storage (buffer passed to Cloudinary) ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"), false);
    }
  },
});

// ── Routes ──────────────────────────────────────────────────────────────────
router.get("/profile", getProfile);
router.put("/profile", updateProfile);
router.post("/logo", upload.single("logo"), uploadLogo);

export default router;
