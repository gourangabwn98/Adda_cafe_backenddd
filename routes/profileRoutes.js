// // routes/admin/restaurantProfile.routes.js
// import express from "express";
// import multer from "multer";
// const router = express.Router();
// // const multer = require("multer");

// import {
//   getProfile,
//   updateProfile,
//   uploadLogo,
// } from "../controllers/profileController.js";

// // const { protect, adminOnly } = require("../../middleware/auth.middleware"); // adjust to your auth middleware

// // ── Multer — in-memory storage (buffer passed to Cloudinary) ────────────────
// const upload = multer({
//   storage: multer.memoryStorage(),
//   limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
//   fileFilter: (_req, file, cb) => {
//     if (file.mimetype.startsWith("image/")) {
//       cb(null, true);
//     } else {
//       cb(new Error("Only image files are allowed"), false);
//     }
//   },
// });

// // ── Routes ──────────────────────────────────────────────────────────────────
// router.get("/profile", getProfile);
// router.put("/profile", updateProfile);
// router.post("/logo", upload.single("logo"), uploadLogo);

// export default router;

// routes/profileRoutes.js
import express from "express";
import multer  from "multer";
import {
  getProfile,
  updateProfile,
  uploadLogo,
  uploadBanner,
  updateBanner,
  deleteBanner,
  addPrinter,
  updatePrinter,
  deletePrinter,
} from "../controllers/profileController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"), false);
  },
});

// ── Profile ────────────────────────────────────────────────────────────────
// GET stays public: restaurant-print-service fetches this at startup with no
// login mechanism of its own, and guest customers in client/adda_cafe read it
// (unauthenticated) to display GST before/without logging in.
router.get   ("/profile",            getProfile);
router.put   ("/profile",            protect, updateProfile);

// ── Logo ───────────────────────────────────────────────────────────────────
router.post  ("/logo",               protect, upload.single("logo"),   uploadLogo);

// ── Banners ────────────────────────────────────────────────────────────────
router.post  ("/banner",             protect, upload.single("banner"), uploadBanner);
router.patch ("/banner/:bannerId",   protect,                          updateBanner);
router.delete("/banner/:bannerId",   protect,                          deleteBanner);

// ── Printer IPs ────────────────────────────────────────────────────────────
router.post  ("/printer",            protect,                          addPrinter);
router.patch ("/printer/:printerId", protect,                          updatePrinter);
router.delete("/printer/:printerId", protect,                          deletePrinter);

export default router;