// ─── routes/menuRoutes.js ────────────────────────────────────────────────────
import express from "express";
import {
  getMenu,
  getCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/menuController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();
router.get("/", getMenu);
router.get("/categories", getCategories);
router.post("/", protect, createMenuItem);
router.put("/:id", protect, updateMenuItem);
router.delete("/:id", protect, deleteMenuItem);

export default router;
