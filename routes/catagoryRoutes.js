import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import {
  createCategory,
  getCategories,
  updateCategory,
} from "../controllers/categoryController.js";

const router = express.Router();

router.get("/", getCategories);
router.post("/", upload.single("image"), createCategory);
router.put("/:id", upload.single("image"), updateCategory);

export default router;
