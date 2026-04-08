import express from "express";
import {
  createChef,
  deleteChef,
  getAllChefs,
  updateChefStatus,
} from "../controllers/chefController.js";
const router = express.Router();
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
router.post("/", createChef);
router.patch("/:id/status", updateChefStatus);
router.delete("/:id", deleteChef);

export default router;
