import express from "express";
import {
  createChef,
  deleteChef,
  getAllChefs,
  updateChefStatus,
  updateChefRole,
  getChefRevenue,
} from "../controllers/chefController.js";
import { protect } from "../middleware/authMiddleware.js";
// import { protect } from "../middleware/authMiddleware.js";
const router = express.Router();
// router.use(protect);
// const {
//   getAllChefs,
//   createChef,
//   updateChefStatus,
//   deleteChef,
// } = require("../controllers/chefController.js");

// const { protect, adminOnly } = require("../middleware/authMiddleware.js"); // your auth middleware

// All routes protected + admin only
// router.use(protect, adminOnly);

router.get("/", getAllChefs);
router.get("/revenue", protect, getChefRevenue);
router.post("/",protect, createChef);
router.patch("/:id/status",protect, updateChefStatus);
router.patch("/:id/role", protect, updateChefRole);
router.delete("/:id",protect, deleteChef);

export default router;
