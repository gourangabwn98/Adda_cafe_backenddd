import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import admin from "firebase-admin";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

// ─── Firebase Init ────────────────────────────────────────────────────────────
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  }),
});

// ─── AUTH CONTROLLER ──────────────────────────────────────────────────────────

// POST /api/auth/firebase-verify
export const firebaseVerify = async (req, res) => {
  try {
    const { firebaseToken, name } = req.body;
    if (!firebaseToken)
      return res.status(400).json({ message: "Token required" });

    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const phone = decoded.phone_number?.replace("+91", "");

    if (!phone)
      return res.status(400).json({ message: "Phone number not found in token" });

    let user = await User.findOne({ phone });
    if (!user) user = new User({ phone });
    user.isVerified = true;
    if (name) user.name = name;
    await user.save();

    res.json({
      _id: user._id,
      name: user.name,
      phone: user.phone,
      token: generateToken(user._id),
    });
  } catch (err) {
    console.error("Firebase Verify Error:", err);
    res.status(401).json({ message: "Invalid or expired Firebase token" });
  }
};

// PUT /api/auth/profile
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: "User not found" });
    user.name = req.body.name || user.name;
    user.vegMode = req.body.vegMode ?? user.vegMode;
    user.language = req.body.language || user.language;
    const updated = await user.save();
    res.json({
      _id: updated._id,
      name: updated.name,
      phone: updated.phone,
      vegMode: updated.vegMode,
      language: updated.language,
    });
  } catch (err) {
    console.error("Update Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// GET /api/auth/profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-otp -otpExpiry");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/auth/veg-mode
export const updateVegMode = async (req, res) => {
  try {
    const { vegMode } = req.body;
    if (typeof vegMode !== "boolean")
      return res.status(400).json({ message: "vegMode must be true or false" });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { vegMode },
      { new: true }
    );

    res.json({ message: "Veg mode updated successfully", vegMode: user.vegMode });
  } catch (err) {
    console.error("Veg Mode Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

// PATCH /api/auth/language
export const updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    if (!language || !["en", "bn"].includes(language))
      return res.status(400).json({ message: "Valid language required (en or bn)" });

    if (!req.user || !req.user._id)
      return res.status(401).json({ message: "Unauthorized: Please login first" });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { language },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({ message: "Language updated successfully", language: user.language });
  } catch (err) {
    console.error("Update Language Error:", err);
    res.status(500).json({
      message: "Server error",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};














