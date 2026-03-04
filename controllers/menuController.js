import jwt from "jsonwebtoken";

import { MenuItem } from "../models/MenuItem.js";
import { Order } from "../models/Order.js";

// ─── MENU CONTROLLER ─────────────────────────────────────────────────────────

// GET /api/menu
export const getMenu = async (req, res) => {
  const { category, tag, search } = req.query;
  const filter = { isAvailable: true };
  if (category) filter.category = category;
  if (tag) filter.tag = tag;
  if (search) filter.name = { $regex: search, $options: "i" };
  const items = await MenuItem.find(filter).sort({ category: 1, name: 1 });
  res.json(items);
};

// GET /api/menu/categories
export const getCategories = async (req, res) => {
  const cats = await MenuItem.distinct("category", { isAvailable: true });
  res.json(cats);
};

// POST /api/menu  [admin]
export const createMenuItem = async (req, res) => {
  const item = await MenuItem.create(req.body);
  res.status(201).json(item);
};

// PUT /api/menu/:id  [admin]
export const updateMenuItem = async (req, res) => {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
  });
  if (!item) return res.status(404).json({ message: "Item not found" });
  res.json(item);
};

// DELETE /api/menu/:id  [admin]
export const deleteMenuItem = async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ message: "Item deleted" });
};
