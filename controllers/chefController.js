// const Chef = require("../models/Chef.js");
// const User = require("../models/User.js"); // assuming you have admin user

import { Chef } from "../models/Chef.js";
import { User } from "../models/User.js";

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
      createdBy: req.user._id,
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
