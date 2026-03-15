import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });

const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

// ─── AUTH CONTROLLER ─────────────────────────────────────────────────────────

// POST /api/auth/send-otp
export const sendOTP = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone number required" });

  const otp = generateOTP();
  const otpExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 min

  let user = await User.findOne({ phone });
  if (!user) user = new User({ phone });
  user.otp = otp;
  user.otpExpiry = otpExpiry;
  await user.save();

  // In production: use Twilio / MSG91
  // await sendSMS(phone, `Your Adda Cafe OTP is ${otp}`);
  console.log(`🔐 OTP for ${phone}: ${otp}`); // dev only

  res.json({
    message: "OTP sent successfully",
    ...(process.env.NODE_ENV === "development" && { otp }),
  });
};

// POST /api/auth/verify-otp
export const verifyOTP = async (req, res) => {
  const { phone, otp, name } = req.body;
  if (!phone || !otp)
    return res.status(400).json({ message: "Phone and OTP required" });

  const user = await User.findOne({ phone });
  if (!user) return res.status(404).json({ message: "User not found" });
  if (user.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });
  if (user.otpExpiry < new Date())
    return res.status(400).json({ message: "OTP expired" });

  user.isVerified = true;
  user.otp = undefined;
  user.otpExpiry = undefined;
  if (name) user.name = name;
  await user.save();

  res.json({
    _id: user._id,
    name: user.name,
    phone: user.phone,
    token: generateToken(user._id),
  });
};

// PUT /api/auth/profile
export const updateProfile = async (req, res) => {
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
};

// GET /api/auth/profile
export const getProfile = async (req, res) => {
  const user = await User.findById(req.user._id).select("-otp -otpExpiry");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
};
//change veg mode
export const updateVegMode = async (req, res) => {
  try {
    const { vegMode } = req.body;

    if (typeof vegMode !== "boolean") {
      return res.status(400).json({
        message: "vegMode must be true or false",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id, // from auth middleware
      { vegMode },
      { new: true },
    );

    res.json({
      message: "Veg mode updated successfully",
      vegMode: user.vegMode,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: "Server error",
    });
  }
};
