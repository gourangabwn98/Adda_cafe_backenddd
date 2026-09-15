// ─── utils/serviceCharge.js ──────────────────────────────────────────────────
// Categories that never incur the restaurant's per-item service charge —
// e.g. takeaway packaging / utility items rather than table service.
// Matched case-insensitively so "Parcel", "parcel", "PARCEL" etc. all count.
export const SERVICE_CHARGE_EXEMPT_CATEGORIES = ["parcel", "water", "gas"];

export const isServiceChargeExempt = (category) =>
  SERVICE_CHARGE_EXEMPT_CATEGORIES.includes(String(category || "").trim().toLowerCase());
