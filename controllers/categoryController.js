// controllers/categoryController.js
import { Category } from "../models/Category.js";
import cloudinary from "../config/cloudinary.js";
import streamifier from "streamifier";

const uploadToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "categories" },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });

// Create Category
export const createCategory = async (req, res) => {
  try {
    let imageUrl = "";

    if (req.file) {
      imageUrl = await uploadToCloudinary(req.file.buffer);
    }

    const category = await Category.create({
      name: req.body.name,
      image: imageUrl,
    });

    res.status(200).json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ message: "Failed to create category" });
  }
};

// Get Categories
export const getCategories = async (req, res) => {
  const categories = await Category.find();
  res.json({ data: categories });
};

// Update Category
export const updateCategory = async (req, res) => {
  let imageUrl = req.body.image;

  if (req.file) {
    imageUrl = await uploadToCloudinary(req.file.buffer);
  }

  const cat = await Category.findByIdAndUpdate(
    req.params.id,
    { name: req.body.name, image: imageUrl },
    { new: true },
  );

  res.json({ data: cat });
};
