// // ─── routes/menuRoutes.js ────────────────────────────────────────────────────
// import express from "express";
// import {
//   getMenu,
//   getCategories,
//   getCategoriesWithImage,
//   createMenuItem,
//   updateMenuItem,
//   deleteMenuItem,
// } from "../controllers/menuController.js";
// import { protect } from "../middleware/authMiddleware.js";

// const router = express.Router();
// router.get("/", getMenu);
// router.get("/categories", getCategories);
// router.get("/categoriesimage", getCategoriesWithImage);
// router.post("/", protect, createMenuItem);
// router.put("/:id", protect, updateMenuItem);
// router.delete("/:id", protect, deleteMenuItem);

// export default router;
import express from "express";
import {
  getMenu,
  getCategories,
  getCategoriesWithImage,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} from "../controllers/menuController.js";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public
router.get("/", getMenu);
router.get("/categories", getCategories);
router.get("/categoriesimage", getCategoriesWithImage);

// Admin — accept up to 2 files: "image" and "categoryImage"
const menuUpload = upload.fields([
  { name: "image", maxCount: 1 },
  { name: "categoryImage", maxCount: 1 },
]);

router.post("/", protect, menuUpload, createMenuItem);
router.put("/:id", protect, menuUpload, updateMenuItem);
router.delete("/:id", protect, deleteMenuItem);

export default router;
