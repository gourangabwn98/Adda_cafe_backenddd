import mongoose from "mongoose";

const tableSchema = new mongoose.Schema(
  {
    tableNo: { type: Number, required: true, unique: true },
    seats: { type: Number, required: true, default: 4 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    label: { type: String },
    notes: { type: String },
    qrUrl: { type: String },
    qrCode: { type: String },
  },
  { timestamps: true },
);

// ✅ FIX: pass `next` as parameter and call it
// tableSchema.pre("save", function (next) {
//   if (!this.label) this.label = `Table ${this.tableNo}`;
//   next(); // ← this was missing or not called
// });

export const Table = mongoose.model("Table", tableSchema);
