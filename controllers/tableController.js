// ─── controllers/tableController.js — generate QR on create ──────────────────
// import QRCode from "qrcode";
import * as QRCode from "qrcode";
import { Table } from "../models/Table.js";

// ── helper: generate QR PNG as base64 data-URI ────────────────────────────────
const generateQR = async (tableNo) => {
  // The URL the customer sees when they scan the QR
  const url = `${process.env.CLIENT_URL}/?table=${tableNo}`;

  const dataUri = await QRCode.toDataURL(url, {
    width: 300,
    margin: 2,
    color: { dark: "#1a1a2e", light: "#ffffff" },
    errorCorrectionLevel: "H",
  });

  return { url, dataUri };
};

// GET /api/tables
export const getTables = async (req, res) => {
  try {
    const tables = await Table.find().sort({ tableNo: 1 });
    res.json({ tables });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/tables/:tableNo
export const getTableByNo = async (req, res) => {
  try {
    const table = await Table.findOne({ tableNo: req.params.tableNo });
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json(table);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/tables
export const createTable = async (req, res) => {
  try {
    const { tableNo, seats, label, notes } = req.body;
    if (!tableNo) return res.status(400).json({ message: "tableNo required" });

    const exists = await Table.findOne({ tableNo });
    if (exists)
      return res
        .status(400)
        .json({ message: `Table ${tableNo} already exists` });

    // Generate QR
    const { url, dataUri } = await generateQR(tableNo);

    const table = await Table.create({
      tableNo,
      seats: seats || 4,
      label: label || `Table ${tableNo}`,
      notes,
      qrUrl: url,
      qrCode: dataUri,
    });

    res.status(201).json(table);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// PUT /api/tables/:tableNo
export const updateTable = async (req, res) => {
  try {
    const table = await Table.findOneAndUpdate(
      { tableNo: req.params.tableNo },
      req.body,
      { new: true, runValidators: true },
    );
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json(table);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// DELETE /api/tables/:tableNo
export const deleteTable = async (req, res) => {
  try {
    const table = await Table.findOneAndDelete({ tableNo: req.params.tableNo });
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json({ message: `Table ${table.tableNo} deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/tables/:tableNo/regenerate-qr  — admin can regenerate QR anytime
export const regenerateQR = async (req, res) => {
  try {
    const { url, dataUri } = await generateQR(req.params.tableNo);
    const table = await Table.findOneAndUpdate(
      { tableNo: req.params.tableNo },
      { qrUrl: url, qrCode: dataUri },
      { new: true },
    );
    if (!table) return res.status(404).json({ message: "Table not found" });
    res.json({ message: "QR regenerated", qrCode: dataUri, qrUrl: url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
