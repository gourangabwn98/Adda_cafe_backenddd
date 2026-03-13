// ─── middleware/authMiddleware.js ────────────────────────────────────────────
import express from "express";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
console.log("JWT_SECRET:", process.env.JWT_SECRET);

export const protect = async (req, res, next) => {
  const auth = req.headers.authorization;

  console.log("AUTH HEADER:", auth);

  if (!auth?.startsWith("Bearer "))
    return res.status(401).json({ message: "Not authorized, no token" });

  try {
    const token = auth.split(" ")[1];
    console.log("TOKEN:", token);
    console.log("SECRET:", process.env.JWT_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("DECODED:", decoded);

    req.user = await User.findById(decoded.id).select("-otp -otpExpiry");
    if (!req.user) return res.status(401).json({ message: "User not found" });

    next();
  } catch (error) {
    console.log("JWT ERROR:", error.message);
    res.status(401).json({ message: "Not authorized, invalid token" });
  }
};

export const optionalProtect = async (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth || !auth.startsWith("Bearer ")) {
    req.user = null; // guest user
    return next();
  }

  try {
    const token = auth.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = await User.findById(decoded.id).select("-otp -otpExpiry");
  } catch (error) {
    req.user = null;
  }

  next();
};

// ─── middleware/errorMiddleware.js ───────────────────────────────────────────
export const notFound = (req, res, next) => {
  next(new Error(`Not Found — ${req.originalUrl}`));
};

export const errorHandler = (err, req, res, _next) => {
  const code = res.statusCode === 200 ? 500 : res.statusCode;
  console.error(err.message);
  res.status(code).json({
    message: err.message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
};
