// ─── utils/serviceCharge.js ──────────────────────────────────────────────────
// Which menu-item categories incur the restaurant's per-item service charge
// is driven entirely by RestaurantProfile.serviceChargeCategories (Admin →
// Profile → Pricing & delivery) — an explicit, Admin-selected allowlist, not
// any hardcoded category name. A category not selected there never incurs
// service charge, no matter what it's called.

// Builds the set of applicable category names from a RestaurantProfile doc
// whose `serviceChargeCategories` has been populated with at least `name`
// (see profileController.getProfile / orderController.computeOrderPricing /
// invoiceController.generateInvoice, all of which populate it the same way).
// Accepts populated {name} subdocs or plain name strings so callers don't
// need to know which shape they received.
export const getApplicableCategoryNames = (restaurant) =>
  (restaurant?.serviceChargeCategories || [])
    .map((c) => (typeof c === "string" ? c : c?.name))
    .filter(Boolean)
    .map((n) => String(n).trim().toLowerCase());

// Whether a single item's category (its stored/snapshotted category name)
// is in the Admin-selected allowlist. Matched case-insensitively/trimmed so
// "Parcel", "parcel", "PARCEL " etc. all count the same, same as before.
export const isServiceChargeApplicable = (category, applicableCategoryNames) => {
  const normalized = String(category || "").trim().toLowerCase();
  return !!normalized && (applicableCategoryNames || []).includes(normalized);
};
