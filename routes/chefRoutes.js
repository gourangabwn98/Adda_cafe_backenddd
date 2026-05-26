import express from "express";
import {
  createChef,
  deleteChef,
  getAllChefs,
  updateChefStatus,
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
router.post("/",protect, createChef);
router.patch("/:id/status",protect, updateChefStatus);
router.delete("/:id",protect, deleteChef);

export default router;
