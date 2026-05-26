import cloudinary from "../config/cloudinary.js";
import { RestaurantProfile } from "../models/restaurantProfile.js";
import streamifier from "streamifier";

// ── Helper ─────────────────────────────────────────────────────────────────────
const uploadToCloudinary = (buffer, folder = "restaurant", transformOptions) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp", "avif"],
        transformation: transformOptions ?? [
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

const getOrCreateProfile = async () => {
  let profile = await RestaurantProfile.findOne();
  if (!profile)
    profile = await RestaurantProfile.create({ restaurantName: "My Restaurant" });
  return profile;
};

// ── Profile ────────────────────────────────────────────────────────────────────
export const getProfile = async (req, res) => {
  try {
    const profile = await getOrCreateProfile();
    res.status(200).json({ success: true, data: profile });
  } catch (err) {
    console.error("[getProfile]", err);
    res.status(500).json({ success: false, message: "Failed to load profile" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    const PROTECTED = ["_id", "__v", "createdAt", "updatedAt", "logo", "banners", "printerIps"];
    const payload = { ...req.body };
    PROTECTED.forEach((key) => delete payload[key]);

    if (payload.latitude  !== undefined) payload.latitude  = Number(payload.latitude)  || null;
    if (payload.longitude !== undefined) payload.longitude = Number(payload.longitude) || null;

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $set: payload },
      { new: true, upsert: true, runValidators: true },
    );
    res.status(200).json({ success: true, data: profile, message: "Profile updated successfully" });
  } catch (err) {
    console.error("[updateProfile]", err);
    if (err.name === "ValidationError")
      return res.status(422).json({ success: false, message: err.message });
    res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// ── Logo ───────────────────────────────────────────────────────────────────────
export const uploadLogo = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    const logoUrl = await uploadToCloudinary(req.file.buffer, "restaurant/logos");
    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $set: { logo: logoUrl } },
      { new: true, upsert: true },
    );
    res.status(200).json({ success: true, logoUrl, data: profile, message: "Logo uploaded successfully" });
  } catch (err) {
    console.error("[uploadLogo]", err);
    res.status(500).json({ success: false, message: "Failed to upload logo" });
  }
};

// ── Banners ────────────────────────────────────────────────────────────────────
export const uploadBanner = async (req, res) => {
  try {
    if (!req.file)
      return res.status(400).json({ success: false, message: "No file uploaded" });

    const imageUrl = await uploadToCloudinary(
      req.file.buffer,
      "restaurant/banners",
      [{ width: 1200, height: 400, crop: "limit", quality: "auto" }],
    );

    const newBanner = {
      imageUrl,
      link:   req.body.link ?? "",
      active: req.body.active !== "false",
    };

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $push: { banners: newBanner } },
      { new: true, upsert: true },
    );

    res.status(201).json({
      success: true,
      banner:  profile.banners.at(-1),
      data:    profile,
      message: "Banner uploaded successfully",
    });
  } catch (err) {
    console.error("[uploadBanner]", err);
    res.status(500).json({ success: false, message: "Failed to upload banner" });
  }
};

// export const updateBanner = async (req, res) => {
//   try {
//     const { bannerId } = req.params;
//     const { link, active } = req.body;

//     const update = {};
//     if (link   !== undefined) update["banners.$.link"]   = link;
//     if (active !== undefined) update["banners.$.active"] = active !== "false" && active !== false;

//     const profile = await RestaurantProfile.findOneAndUpdate(
//       { "banners._id": bannerId },
//       { $set: update },
//       { new: true },
//     );
//     if (!profile)
//       return res.status(404).json({ success: false, message: "Banner not found" });

//     res.status(200).json({ success: true, banner: profile.banners.id(bannerId), data: profile });
//   } catch (err) {
//     console.error("[updateBanner]", err);
//     res.status(500).json({ success: false, message: "Failed to update banner" });
//   }
// };

// export const deleteBanner = async (req, res) => {
//   try {
//     const { bannerId } = req.params;
//     const profile = await RestaurantProfile.findOneAndUpdate(
//       {},
//       { $pull: { banners: { _id: bannerId } } },
//       { new: true },
//     );
//     if (!profile)
//       return res.status(404).json({ success: false, message: "Profile not found" });

//     res.status(200).json({ success: true, data: profile, message: "Banner deleted" });
//   } catch (err) {
//     console.error("[deleteBanner]", err);
//     res.status(500).json({ success: false, message: "Failed to delete banner" });
//   }
// };

// ── Printer IPs ────────────────────────────────────────────────────────────────
export const addPrinter = async (req, res) => {
  try {
    const { ip, name = "Printer", active = true } = req.body;
    if (!ip)
      return res.status(400).json({ success: false, message: "IP address is required" });

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $push: { printerIps: { ip, name, active } } },
      { new: true, upsert: true },
    );
    res.status(201).json({
      success: true,
      printer: profile.printerIps.at(-1),
      data:    profile,
      message: "Printer added successfully",
    });
  } catch (err) {
    console.error("[addPrinter]", err);
    res.status(500).json({ success: false, message: "Failed to add printer" });
  }
};

// export const updatePrinter = async (req, res) => {
//   try {
//     const { printerId } = req.params;
//     const { ip, name, active } = req.body;

//     const update = {};
//     if (ip     !== undefined) update["printerIps.$.ip"]     = ip;
//     if (name   !== undefined) update["printerIps.$.name"]   = name;
//     if (active !== undefined) update["printerIps.$.active"] = active;

//     const profile = await RestaurantProfile.findOneAndUpdate(
//       { "printerIps._id": printerId },
//       { $set: update },
//       { new: true },
//     );
//     if (!profile)
//       return res.status(404).json({ success: false, message: "Printer not found" });

//     res.status(200).json({ success: true, printer: profile.printerIps.id(printerId), data: profile });
//   } catch (err) {
//     console.error("[updatePrinter]", err);
//     res.status(500).json({ success: false, message: "Failed to update printer" });
//   }
// };

// export const deletePrinter = async (req, res) => {
//   try {
//     const { printerId } = req.params;
//     const profile = await RestaurantProfile.findOneAndUpdate(
//       {},
//       { $pull: { printerIps: { _id: printerId } } },
//       { new: true },
//     );
//     if (!profile)
//       return res.status(404).json({ success: false, message: "Profile not found" });

//     res.status(200).json({ success: true, data: profile, message: "Printer deleted" });
//   } catch (err) {
//     console.error("[deletePrinter]", err);
//     res.status(500).json({ success: false, message: "Failed to delete printer" });
//   }
// };
// ── Banners ────────────────────────────────────────────────────────────────────
export const updateBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;
    const { link, active } = req.body;

    const update = {};
    if (link   !== undefined) update["banners.$.link"]   = link;
    if (active !== undefined) update["banners.$.active"] = active !== "false" && active !== false;

    const profile = await RestaurantProfile.findOneAndUpdate(
      { "banners._id": bannerId },
      { $set: update },
      { new: true },
    );
    if (!profile)
      return res.status(404).json({ success: false, message: "Banner not found" });

    // ✅ .find() instead of .id()
    const banner = profile.banners.find(b => b._id.toString() === bannerId);
    res.status(200).json({ success: true, banner, data: profile });
  } catch (err) {
    console.error("[updateBanner]", err);
    res.status(500).json({ success: false, message: "Failed to update banner" });
  }
};

export const deleteBanner = async (req, res) => {
  try {
    const { bannerId } = req.params;

    // ✅ Check profile exists first
    const exists = await RestaurantProfile.findOne({ "banners._id": bannerId });
    if (!exists)
      return res.status(404).json({ success: false, message: "Banner not found" });

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $pull: { banners: { _id: bannerId } } },
      { new: true },
    );
    res.status(200).json({ success: true, data: profile, message: "Banner deleted" });
  } catch (err) {
    console.error("[deleteBanner]", err);
    res.status(500).json({ success: false, message: "Failed to delete banner" });
  }
};

// ── Printer IPs ────────────────────────────────────────────────────────────────
export const updatePrinter = async (req, res) => {
  try {
    const { printerId } = req.params;
    const { ip, name, active } = req.body;

    const update = {};
    if (ip     !== undefined) update["printerIps.$.ip"]     = ip;
    if (name   !== undefined) update["printerIps.$.name"]   = name;
    if (active !== undefined) update["printerIps.$.active"] = active;

    const profile = await RestaurantProfile.findOneAndUpdate(
      { "printerIps._id": printerId },
      { $set: update },
      { new: true },
    );
    if (!profile)
      return res.status(404).json({ success: false, message: "Printer not found" });

    // ✅ .find() instead of .id()
    const printer = profile.printerIps.find(p => p._id.toString() === printerId);
    res.status(200).json({ success: true, printer, data: profile });
  } catch (err) {
    console.error("[updatePrinter]", err);
    res.status(500).json({ success: false, message: "Failed to update printer" });
  }
};

export const deletePrinter = async (req, res) => {
  try {
    const { printerId } = req.params;

    // ✅ Check printer exists first
    const exists = await RestaurantProfile.findOne({ "printerIps._id": printerId });
    if (!exists)
      return res.status(404).json({ success: false, message: "Printer not found" });

    const profile = await RestaurantProfile.findOneAndUpdate(
      {},
      { $pull: { printerIps: { _id: printerId } } },
      { new: true },
    );
    res.status(200).json({ success: true, data: profile, message: "Printer deleted" });
  } catch (err) {
    console.error("[deletePrinter]", err);
    res.status(500).json({ success: false, message: "Failed to delete printer" });
  }
};