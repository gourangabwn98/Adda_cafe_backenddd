// import { Table } from "../models/Table.js";

import { Table } from "../models/Table.js";

// Get all tables
export const getAllTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNo: 1 });
    res.json({ success: true, tables });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// Create new table
export const createTable = async (req, res) => {
  try {
    const { tableNo, seats, notes } = req.body;

    // Check if table number already exists
    const existing = await Table.findOne({ tableNo });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `Table ${tableNo} already exists`,
      });
    }

    const table = await Table.create({ tableNo, seats, notes });
    res.status(201).json({ success: true, table });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Update table (seats, status, notes)
export const updateTable = async (req, res) => {
  try {
    const { seats, status, notes } = req.body;
    const table = await Table.findOneAndUpdate(
      { tableNo: req.params.tableNo },
      { seats, status, notes },
      { new: true, runValidators: true },
    );

    if (!table) {
      return res
        .status(404)
        .json({ success: false, message: "Table not found" });
    }

    res.json({ success: true, table });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// Delete table
export const deleteTable = async (req, res) => {
  try {
    const table = await Table.findOneAndDelete({ tableNo: req.params.tableNo });

    if (!table) {
      return res
        .status(404)
        .json({ success: false, message: "Table not found" });
    }

    res.json({ success: true, message: `Table ${table.tableNo} deleted` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
