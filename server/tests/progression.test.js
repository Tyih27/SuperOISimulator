import assert from "node:assert/strict";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function sid(response) {
  return response.cookies.find(({ name }) => name === "sid");
}

const app = await buildTestApp({ config: { idFactory: () => "stable-recruit-id", now: () => new Date("2026-08-19T12:00:00.000Z") } });
try {
  const registered = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "progression01", password: PASSWORD },
  });
  const cookie = sid(registered);
  assert.ok(cookie);
  const auth = { sid: cookie.value };

  const initial = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth });
  assert.equal(initial.statusCode, 200);
  const before = initial.json();
  const abilityBefore = before.students.planner.abilities.dynamicProgramming;
  await app.db.query(
    "UPDATE player_profiles SET payload = jsonb_set(payload, '{inventory,specialist-book-dynamicProgramming}', '1'::jsonb) WHERE account_id = $1",
    [before.accountId],
  );

  const training = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "planner", ability: "dynamicProgramming" },
  });
  assert.equal(training.statusCode, 200);
  assert.equal(training.json().profile.students.planner.abilities.dynamicProgramming, abilityBefore + 40);
  assert.equal(training.json().profile.inventory["specialist-book-dynamicProgramming"], 0);

  const purchase = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "daily-dp-book" },
  });
  assert.equal(purchase.statusCode, 200);
  const limited = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "daily-dp-book" },
  });
  assert.equal(limited.statusCode, 409);
  assert.equal(limited.json().code, "SHOP_PURCHASE_LIMIT_REACHED");

  const recruitment = await request(app, { method: "POST", url: "/api/v1/progression/recruitment", cookies: auth, payload: {} });
  assert.equal(recruitment.statusCode, 200);
  assert.equal(Object.keys(recruitment.json().profile.students).length, 7);
  assert.ok(recruitment.json().profile.students[recruitment.json().student.id]);

  const currencyEntries = await app.db.query("SELECT currency, delta, source_type FROM currency_ledger ORDER BY id");
  assert.deepEqual(currencyEntries.rows.map(({ currency, delta, source_type: sourceType }) => [currency, delta, sourceType]), [
    ["trainingCoins", -100, "specialist-training"],
    ["trainingCoins", -120, "shop"],
    ["recruitmentTickets", -1, "recruitment"],
  ]);
  const inventoryEntries = await app.db.query("SELECT item_id, quantity, source_type FROM inventory_entries ORDER BY id");
  assert.deepEqual(inventoryEntries.rows.map(({ item_id: itemId, quantity, source_type: sourceType }) => [itemId, quantity, sourceType]), [
    ["specialist-book-dynamicProgramming", 1, "shop"],
  ]);
  console.log("progression API tests passed");
} finally {
  await app.close();
}
