// controllers/admin/restaurantProfile.controller.js

import cloudinary from "../config/cloudinary.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import streamifier from "streamifier";

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Upload a buffer to Cloudinary via a stream.
 * Returns the secure_url of the uploaded asset.
 */
const uploadToCloudinary = (buffer, folder = "restaurant") =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        transformation: [
          { width: 400, height: 400, crop: "limit", quality: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

/**
 * Fetch (or seed) the single restaurant profile document.
 * There is always exactly ONE profile in the collection.
 */
const getOrCreateProfile = async () => {
  let profile = await RestaurantProfile.findOne();
  if (!profile) {
    profile = await RestaurantProfile.create({
      restaurantName: "My Restaurant",
    });
  }
  return profile;
};

// ── Controllers ────────────────────────────────────────────────────────────────

/**
 * GET /admin/restaurant/profile
 */
export const getProfile = async (req, res) => {
  try {
    const profile = await getOrCreateProfile();
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("[getProfile]", err);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

/**
 * PUT /admin/restaurant/profile
 */
export const updateProfile = async (req, res) => {
  try {
    // Fields the client must NOT be able to overwrite via this endpoint
    const PROTECTED = ["_id", "__v", "createdAt", "updatedAt", "logo"];

    // Strip protected fields from payload
    const payload = { ...req.body };
    PROTECTED.forEach((key) => delete payload[key]);

    // Parse nested numeric/boolean strings sent by some form libs
    if (payload.latitude !== undefined)
      payload.latitude = Number(payload.latitude) || null;
    if (payload.longitude !== undefined)
      payload.longitude = Number(payload.longitude) || null;

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $set: payload },
      { new: true, upsert: true, runValidators: true },
    );

    res.status(200).json({
      success: true,
      data: profile,
      message: "Profile updated successfully",
    });
  } catch (err) {
    console.error("[updateProfile]", err);
    if (err.name === "ValidationError") {
      return res.status(422).json({ success: false, message: err.message });
    }
    res
      .status(500)
      .json({ success: false, message: "Failed to update profile" });
  }
};

/**
 * POST /admin/restaurant/logo
 * Expects multipart/form-data with field name "logo"
 */
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: "No file uploaded" });
    }

    const logoUrl = await uploadToCloudinary(
      req.file.buffer,
      "restaurant/logos",
    );

    // Save URL to profile
    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $set: { logo: logoUrl } },
      { new: true, upsert: true },
    );

    res.status(200).json({
      success: true,
      logoUrl,
      data: profile,
      message: "Logo uploaded successfully",
    });
  } catch (err) {
    console.error("[uploadLogo]", err);
    res.status(500).json({ success: false, message: "Failed to upload logo" });
  }
};
