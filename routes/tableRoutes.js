import express from "express";
import {
  getTables,
  getTableByNo,
  createTable,
  updateTable,
  deleteTable,
  regenerateQR,
} from "../controllers/tableController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", getTables);
router.get("/:tableNo", getTableByNo);
router.post("/", protect, createTable);
router.put("/:tableNo", protect, updateTable);
router.delete("/:tableNo", protect, deleteTable);
router.post("/:tableNo/regenerate-qr", protect, regenerateQR);

export default router;
