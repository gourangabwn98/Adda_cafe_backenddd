// ─── controllers/adminUpdateOrderItems.test.js ────────────────────────────
// Automated tests for the Admin order-modification feature, run via Node's
// built-in test runner — no new package installed.
//
//   node --experimental-test-module-mocks --test controllers/adminUpdateOrderItems.test.js
//
// server.js (imported by orderController.js for `io`) starts a real HTTP
// server and connects to MongoDB as a side effect of being imported — that
// must never happen in a unit test, so it — along with the Mongoose
// models — is mocked via mock.module() BEFORE orderController.js is
// imported. This also means computeOrderPricing (the shared pricing
// function reused by both the customer and Admin modify paths) runs for
// real here, against the fake MenuItem/RestaurantProfile data below —
// these tests exercise the actual pricing/service-charge/tax logic, not a
// re-implementation of it.
import { test, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

const emittedEvents = [];
mock.module("../server.js", {
  namedExports: {
    io: { emit: (event, payload) => emittedEvents.push({ event, payload }) },
  },
});

let fakeMenuItems = [];
mock.module("../models/MenuItem.js", {
  namedExports: {
    MenuItem: {
      find: async (query) => fakeMenuItems.filter((m) => query._id.$in.includes(m._id)),
    },
  },
});

let fakeProfile = { serviceCharge: 0, gstRate: 0, serviceChargeCategories: [] };
mock.module("../models/restaurantProfile.js", {
  namedExports: {
    RestaurantProfile: {
      // Mirrors the real chain: findOne().sort({...}).populate(...)
      findOne: () => ({
        sort: () => ({
          populate: () => Promise.resolve(fakeProfile),
        }),
      }),
    },
  },
});

let fakeOrder = null;
mock.module("../models/Order.js", {
  namedExports: {
    Order: {
      findById: async () => fakeOrder,
    },
  },
});

const { adminUpdateOrderItems } = await import("./orderController.js");
const { requireAdmin } = await import("../middleware/authMiddleware.js");

function makeRes() {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
}

function makeFakeOrder(status) {
  return {
    _id: "order1",
    status,
    orderType: "Dining",
    items: [],
    save: async function () { return this; },
  };
}

beforeEach(() => {
  emittedEvents.length = 0;
  fakeMenuItems = [{ _id: "m1", name: "Burger", price: 100, category: "Food", isAvailable: true }];
  fakeProfile = { serviceCharge: 0, gstRate: 0, serviceChargeCategories: [] };
});

// ── 1 & 2: allowed statuses ────────────────────────────────────────────────
test("1. Admin modifies a Placed order -> success (200), totals recalculated, event emitted", async () => {
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 2 }] } };
  const res = makeRes();

  await adminUpdateOrderItems(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(fakeOrder.subtotal, 200);
  assert.equal(fakeOrder.total, 200);
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0].event, "order-status-updated");
});

test("2. Admin modifies a Preparing order -> success (200)", async () => {
  fakeOrder = makeFakeOrder("Preparing");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 1 }] } };
  const res = makeRes();

  await adminUpdateOrderItems(req, res);
  assert.equal(res.statusCode, 200);
});

// ── 3-6: disallowed statuses (using the schema's actual enum values) ──────
for (const status of ["PendingConfirmation", "Ready", "delivered", "Completed"]) {
  test(`3-6. Admin cannot modify a "${status}" order -> rejected (400)`, async () => {
    fakeOrder = makeFakeOrder(status);
    const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 1 }] } };
    const res = makeRes();

    await adminUpdateOrderItems(req, res);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.message, /cannot be modified/i);
    assert.equal(emittedEvents.length, 0, "no update should be broadcast for a rejected modification");
  });
}

// ── 7-10: item/quantity recalculation ───────────────────────────────────
test("7. Add item -> subtotal includes it", async () => {
  fakeMenuItems.push({ _id: "m2", name: "Fries", price: 50, category: "Food", isAvailable: true });
  fakeOrder = makeFakeOrder("Placed");
  const req = {
    params: { id: "order1" },
    body: { items: [{ menuItemId: "m1", qty: 1 }, { menuItemId: "m2", qty: 1 }] },
  };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.subtotal, 150);
  assert.equal(fakeOrder.items.length, 2);
});

test("8. Increase quantity -> subtotal recalculates", async () => {
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 5 }] } };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.subtotal, 500);
});

test("9. Decrease quantity -> subtotal recalculates", async () => {
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 1 }] } };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.subtotal, 100);
});

test("10. Remove item (submit remaining items only) -> excluded from recalculated totals", async () => {
  fakeMenuItems.push({ _id: "m2", name: "Fries", price: 50, category: "Food", isAvailable: true });
  fakeOrder = makeFakeOrder("Placed");
  // Admin submits only m1 — m2 is being removed.
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 1 }] } };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.items.length, 1);
  assert.equal(fakeOrder.subtotal, 100);
});

// ── 11: service charge follows the Admin-selected category allowlist ─────
test("11a. Service charge applies to a selected category", async () => {
  fakeProfile = { serviceCharge: 10, gstRate: 0, serviceChargeCategories: [{ name: "Food" }] };
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 2 }] } }; // category "Food"
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.serviceCharge, 20); // ₹10 × 2 chargeable items
});

test("11b. Service charge is zero for a category NOT selected", async () => {
  fakeMenuItems = [{ _id: "m1", name: "Water Bottle", price: 20, category: "Water", isAvailable: true }];
  fakeProfile = { serviceCharge: 10, gstRate: 0, serviceChargeCategories: [{ name: "Food" }] }; // "Water" not selected
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 3 }] } };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.serviceCharge, 0);
});

// ── 12: tax recalculation ─────────────────────────────────────────────────
test("12. GST/tax recalculates from the restaurant's current gstRate", async () => {
  fakeProfile = { serviceCharge: 0, gstRate: 10, serviceChargeCategories: [] };
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 2 }] } }; // subtotal 200
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(fakeOrder.tax, 20); // 10% of ₹200
});

// ── 13: authorization ─────────────────────────────────────────────────────
test("13a. requireAdmin rejects a non-admin authenticated user (403)", () => {
  const req = { user: { isAdmin: false } };
  const res = makeRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("13b. requireAdmin rejects when req.user is missing entirely", () => {
  const req = {};
  const res = makeRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.equal(res.statusCode, 403);
  assert.equal(nextCalled, false);
});

test("13c. requireAdmin allows an actual admin account through", () => {
  const req = { user: { isAdmin: true } };
  const res = makeRes();
  let nextCalled = false;
  requireAdmin(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
});

// ── 14: realtime broadcast ────────────────────────────────────────────────
test("14. A successful modification emits order-status-updated with the updated order", async () => {
  fakeOrder = makeFakeOrder("Placed");
  const req = { params: { id: "order1" }, body: { items: [{ menuItemId: "m1", qty: 1 }] } };
  await adminUpdateOrderItems(req, makeRes());
  assert.equal(emittedEvents.length, 1);
  assert.equal(emittedEvents[0].event, "order-status-updated");
  assert.equal(emittedEvents[0].payload._id, "order1");
});
