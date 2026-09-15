import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../controllers/categoryController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

// GET stays public: client/adda_cafe reads categories for guest (unauthenticated)
// menu browsing, same as the public GET /menu/categories in menuRoutes.js.
router.get("/", getCategories);
router.post("/", protect, upload.single("image"), createCategory);
router.put("/:id", protect, upload.single("image"), updateCategory);
router.delete("/:id", protect, deleteCategory);

export default router;
