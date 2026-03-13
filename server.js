import express from "express";
import "./config/env.js";

import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";

// dotenv.config();
connectDB();

const app = express();

// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
const allowedOrigins = [
  "http://localhost:5173",
  "https://adda-cafe-frontenddd.vercel.app",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_, res) =>
  res.json({ status: "OK", time: new Date() }),
);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/invoices", invoiceRoutes);

// Error handlers

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
console.log("JWT_SECRET server:", process.env.JWT_SECRET);
