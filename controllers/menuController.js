// import jwt from "jsonwebtoken";

// import { MenuItem } from "../models/MenuItem.js";
// import { Order } from "../models/Order.js";

// // ─── MENU CONTROLLER ─────────────────────────────────────────────────────────

// // GET /api/menu
// export const getMenu = async (req, res) => {
//   const { category, tag, search } = req.query;
//   const filter = { isAvailable: true };
//   if (category) filter.category = category;
//   if (tag) filter.tag = tag;
//   if (search) filter.name = { $regex: search, $options: "i" };
//   const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
//   res.json(items);
// };

// // GET /api/menu/categories
// export const getCategories = async (req, res) => {
//   const cats = await MenuItem.distinct("category", { isAvailable: true });
//   res.json(cats);
// };

// // GET /api/menu/categories-with-image
// export const getCategoriesWithImage = async (req, res) => {
//   try {
//     const categories = await MenuItem.aggregate([
//       { $match: { isAvailable: true } },
//       {
//         $group: {
//           _id: "$category",
//           categoryImage: { $first: "$categoryImage" },
//         },
//       },
//       {
//         $project: {
//           _id: 0,
//           category: "$_id",
//           categoryImage: 1,
//         },
//       },
//       { $sort: { category: 1 } },
//     ]);

//     res.json(categories);
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // POST /api/menu  [admin]
// export const createMenuItem = async (req, res) => {
//   const item = await MenuItem.create(req.body);
//   res.status(201).json(item);
// };

// // PUT /api/menu/:id  [admin]
// export const updateMenuItem = async (req, res) => {
//   const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
//     new: true,
//   });
//   if (!item) return res.status(404).json({ message: "Item not found" });
//   res.json(item);
// };

// // DELETE /api/menu/:id  [admin]
// export const deleteMenuItem = async (req, res) => {
//   await MenuItem.findByIdAndDelete(req.params.id);
//   res.json({ message: "Item deleted" });
// };
import { MenuItem } from "../models/MenuItem.js";
import {
  uploadToCloudinary,
  deleteFromCloudinary,
} from "../middleware/uploadMiddleware.js";

// GET /api/menu
export const getMenu = async (req, res) => {
  try {
    const { category, tag, search } = req.query;
    const filter = { isAvailable: true };
    if (category) filter.category = category;
    if (tag) filter.tag = tag;
    if (search) filter.name = { $regex: search, $options: "i" };
    const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/menu/categories
export const getCategories = async (req, res) => {
  try {
    const cats = await MenuItem.distinct("category", { isAvailable: true });
    res.json(cats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/menu/categoriesimage
export const getCategoriesWithImage = async (req, res) => {
  try {
    const categories = await MenuItem.aggregate([
      { $match: { isAvailable: true } },
      {
        $group: {
          _id: "$category",
          categoryImage: { $first: "$categoryImage" },
        },
      },
      { $project: { _id: 0, category: "$_id", categoryImage: 1 } },
      { $sort: { category: 1 } },
    ]);
    res.json(categories);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/menu  ── multipart/form-data
export const createMenuItem = async (req, res) => {
  try {
    const body = { ...req.body };

    // Upload item image if file sent
    if (req.files?.image?.[0]) {
      body.image = await uploadToCloudinary(
        req.files.image[0].buffer,
        "adda-menu",
      );
    }
    // Upload category image if file sent
    if (req.files?.categoryImage?.[0]) {
      body.categoryImage = await uploadToCloudinary(
        req.files.categoryImage[0].buffer,
        "adda-categories",
      );
    }

    // coerce types (multipart sends everything as strings)
    if (body.price) body.price = Number(body.price);
    if (body.originalPrice) body.originalPrice = Number(body.originalPrice);
    if (body.rating) body.rating = Number(body.rating);
    if (body.isAvailable !== undefined)
      body.isAvailable = body.isAvailable === "true";

    const item = await MenuItem.create(body);
    res.status(201).json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/menu/:id  ── multipart/form-data
export const updateMenuItem = async (req, res) => {
  try {
    const existing = await MenuItem.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Item not found" });

    const body = { ...req.body };

    // Upload new item image → delete old one
    if (req.files?.image?.[0]) {
      await deleteFromCloudinary(existing.image);
      body.image = await uploadToCloudinary(
        req.files.image[0].buffer,
        "adda-menu",
      );
    }
    // Upload new category image → delete old one
    if (req.files?.categoryImage?.[0]) {
      await deleteFromCloudinary(existing.categoryImage);
      body.categoryImage = await uploadToCloudinary(
        req.files.categoryImage[0].buffer,
        "adda-categories",
      );
    }

    // coerce types
    if (body.price !== undefined) body.price = Number(body.price);
    if (body.originalPrice !== undefined)
      body.originalPrice = body.originalPrice
        ? Number(body.originalPrice)
        : undefined;
    if (body.rating !== undefined) body.rating = Number(body.rating);
    if (body.isAvailable !== undefined)
      body.isAvailable =
        body.isAvailable === "true" || body.isAvailable === true;

    const item = await MenuItem.findByIdAndUpdate(req.params.id, body, {
      new: true,
      runValidators: true,
    });
    res.json(item);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/menu/:id
export const deleteMenuItem = async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: "Item not found" });

    // delete images from cloudinary
    await deleteFromCloudinary(item.image);
    await deleteFromCloudinary(item.categoryImage);

    res.json({ message: "Item deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
