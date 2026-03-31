import dns from "node:dns";
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import express from "express";
import "./config/env.js";

import cors from "cors";
import connectDB from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import menuRoutes from "./routes/menuRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import invoiceRoutes from "./routes/invoiceRoutes.js";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import adminRoutes from "./routes/adminRoutes.js";

// dotenv.config();
connectDB();

const app = express();

// app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
const allowedOrigins = [
  "http://localhost:5173", //user
  "http://localhost:5174", //admin
  "https://adda-cafe-frontenddd.vercel.app", //user
  "https://adda-kitchen.vercel.app", //chef kitchen
  "https://www.addacafes.com", //user production with custom domain
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
app.use("/api/admin", adminRoutes);

// Error handlers

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
console.log("JWT_SECRET server:", process.env.JWT_SECRET);
