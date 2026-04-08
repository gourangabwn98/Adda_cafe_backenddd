import express from "express";
import {
  createTable,
  deleteTable,
  getAllTables,
  updateTable,
} from "../controllers/tableController.js";
const router = express.Router();
// const router = express.Router();

// Protect these routes with admin middleware if you have one
router.get("/", getAllTables);
router.post("/", createTable);
router.put("/:tableNo", updateTable);
router.delete("/:tableNo", deleteTable);

export default router;
