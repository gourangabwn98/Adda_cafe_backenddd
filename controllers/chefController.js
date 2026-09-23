// const Chef = require("../models/Chef.js");
// const User = require("../models/User.js"); // assuming you have admin user

import mongoose from "mongoose";
import { Chef } from "../models/Chef.js";
import { User } from "../models/User.js";
import { Order } from "../models/Order.js";
import { getISTDayRange, todayIST } from "../utils/dateRange.js";

// const { Chef } = require("../models/Chef.js");

// Get all chefs
export const getAllChefs = async (req, res) => {
  try {
    const chefs = await Chef.find().sort({ createdAt: -1 });
    res.json({ success: true, chefs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create new chef
export const createChef = async (req, res) => {
  try {
    const { name, phone, status } = req.body;

    if (!name || !phone) {
      return res
        .status(400)
        .json({ success: false, message: "Name and phone are required" });
    }

    // Check if phone already exists
    const existingChef = await Chef.findOne({ phone });
    if (existingChef) {
      return res.status(400).json({
        success: false,
        message: "Chef with this phone number already exists",
      });
    }

    const chef = await Chef.create({
      name: name.trim(),
      phone: phone.trim(),
      status: status || "Active",
      // createdBy: req.user._id,
      createdBy: req.user?._id || null,
    });

    res.status(201).json({
      success: true,
      message: "Chef created successfully",
      chef,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update chef status (Active / Inactive)
export const updateChefStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const chef = await Chef.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true },
    );

    if (!chef) {
      return res
        .status(404)
        .json({ success: false, message: "Chef not found" });
    }

    res.json({
      success: true,
      message: `Chef status updated to ${status}`,
      chef,
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// GET /api/admin/chefs/revenue?chefId=<optional>&date=YYYY-MM-DD
// Waiter-wise daily revenue: Cash vs Online, for orders actually collected
// (paymentStatus "Paid"), grouped by the order's assigned waiter
// (Order.chefId — set when a waiter places an order, or accepts a Client
// order; unassigned orders are excluded). Computed from orders rather than
// stored per-order records, so an order paid/completed more than once is
// still counted exactly once, at its current total.
// Defaults to today (IST); pass `chefId` to scope to one
// staff member (used by the Waiter app for its own "My Daily Revenue").
export const getChefRevenue = async (req, res) => {
  try {
    const { chefId, date } = req.query;

    const resolvedDate = date || todayIST();
    const { start: dayStart } = getISTDayRange(resolvedDate);
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const match = {
      paymentStatus: "Paid",
      chefId: { $ne: null },
      createdAt: { $gte: dayStart, $lt: dayEnd },
    };
    if (chefId) {
      if (!mongoose.Types.ObjectId.isValid(chefId))
        return res.status(400).json({ success: false, message: "Invalid chefId" });
      match.chefId = new mongoose.Types.ObjectId(chefId);
    }

    const rows = await Order.aggregate([
      { $match: match },
      {
        $group: {
          _id: { chefId: "$chefId", paymentMethod: "$paymentMethod" },
          amount: { $sum: "$total" },
        },
      },
    ]);

    const byChef = {};
    for (const r of rows) {
      const id = String(r._id.chefId);
      if (!byChef[id]) byChef[id] = { chefId: id, cash: 0, online: 0 };
      // Orders placed before paymentMethod existed (or any other legacy
      // value) fall back into "cash" rather than being silently dropped.
      const key = r._id.paymentMethod === "Online" ? "online" : "cash";
      byChef[id][key] += r.amount;
    }

    const chefIds = Object.keys(byChef);
    const chefDocs = chefIds.length
      ? await Chef.find({ _id: { $in: chefIds } }).select("name").lean()
      : [];
    const nameById = Object.fromEntries(chefDocs.map((c) => [String(c._id), c.name]));

    const chefsRevenue = Object.values(byChef)
      .map((r) => ({
        chefId: r.chefId,
        name: nameById[r.chefId] || "Unknown",
        cash: r.cash,
        online: r.online,
        total: r.cash + r.online,
      }))
      .sort((a, b) => b.total - a.total);

    res.json({ success: true, date: resolvedDate, chefs: chefsRevenue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Delete chef
export const deleteChef = async (req, res) => {
  try {
    const chef = await Chef.findByIdAndDelete(req.params.id);

    if (!chef) {
      return res
        .status(404)
        .json({ success: false, message: "Chef not found" });
    }

    res.json({
      success: true,
      message: "Chef account deleted successfully",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
