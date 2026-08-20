import assert from "node:assert/strict";
import { SHOP_OFFERS } from "../../src/data.js";
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
    payload: { offerId: " daily-dp-book " },
  });
  assert.equal(purchase.statusCode, 200);
  const limited = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "daily-dp-book" },
  });
  assert.equal(limited.statusCode, 409);
  assert.equal(limited.json().code, "SHOP_PURCHASE_LIMIT_REACHED");

  const recruitmentRight = await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth, payload: { offerId: "recruitment-right" } });
  assert.equal(recruitmentRight.statusCode, 200);
  assert.equal(recruitmentRight.json().profile.currencies.trainingCoins, 480);
  assert.equal(recruitmentRight.json().profile.currencies.recruitmentTickets, 2);
  await app.db.query("UPDATE player_profiles SET payload = jsonb_set(payload, '{recruitment,attemptsSinceGenius}', '29'::jsonb) WHERE account_id = $1", [before.accountId]);

  const recruitment = await request(app, { method: "POST", url: "/api/v1/progression/recruitment", cookies: auth, payload: {} });
  assert.equal(recruitment.statusCode, 200);
  assert.equal(Object.keys(recruitment.json().profile.students).length, 7);
  assert.ok(recruitment.json().profile.students[recruitment.json().student.id]);
  assert.equal(recruitment.json().student.aptitude, "天才");
  assert.equal(recruitment.json().profile.recruitment.attemptsSinceGenius, 0);

  const dismissedId = recruitment.json().student.id;
  const dismissed = await request(app, {
    method: "POST", url: `/api/v1/progression/students/${encodeURIComponent(dismissedId)}/dismiss`, cookies: auth,
    payload: {},
  });
  assert.equal(dismissed.statusCode, 200);
  assert.equal(dismissed.json().profile.students[dismissedId], undefined);
  assert.equal(dismissed.json().profile.inventory["student-training-material"], 1);

  const protectedDismissal = await request(app, {
    method: "POST", url: "/api/v1/progression/students/planner/dismiss", cookies: auth,
    payload: {},
  });
  assert.equal(protectedDismissal.statusCode, 400);
  assert.match(protectedDismissal.json().message, /Only recruited students/);

  const unknownOffer = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "not-a-real-offer" },
  });
  assert.equal(unknownOffer.statusCode, 400);
  assert.equal(unknownOffer.json().message, "Unknown shop offer");

  const currencyEntries = await app.db.query("SELECT currency, delta, source_type FROM currency_ledger ORDER BY id");
  assert.deepEqual(currencyEntries.rows.map(({ currency, delta, source_type: sourceType }) => [currency, delta, sourceType]), [
    ["trainingCoins", -100, "specialist-training"],
    ["trainingCoins", -120, "shop"],
    ["trainingCoins", -300, "shop"],
    ["recruitmentTickets", 1, "shop"],
    ["recruitmentTickets", -1, "recruitment"],
  ]);
  const inventoryEntries = await app.db.query("SELECT item_id, quantity, source_type FROM inventory_entries ORDER BY id");
  assert.deepEqual(inventoryEntries.rows.map(({ item_id: itemId, quantity, source_type: sourceType }) => [itemId, quantity, sourceType]), [
    ["specialist-book-dynamicProgramming", 1, "shop"],
    ["student-training-material", 1, "student-dismissal"],
  ]);
  const auditEntries = await app.db.query("SELECT action_type FROM account_audit_log ORDER BY id");
  assert.deepEqual(auditEntries.rows.map(({ action_type: actionType }) => actionType), [
    "specialist_training", "shop_purchase", "shop_purchase", "student_recruitment", "student_dismissal",
  ]);

  const catalogRegistered = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "shopcatalog01", password: PASSWORD },
  });
  const catalogCookie = sid(catalogRegistered);
  assert.ok(catalogCookie);
  for (const offer of SHOP_OFFERS) {
    const catalogPurchase = await request(app, {
      method: "POST", url: "/api/v1/progression/shop/purchases", cookies: { sid: catalogCookie.value },
      payload: { offerId: offer.id },
    });
    assert.equal(catalogPurchase.statusCode, 200, `catalog offer ${offer.id} must be purchasable`);
    assert.equal(catalogPurchase.json().offer.id, offer.id);
  }
  console.log("progression API tests passed");
} finally {
  await app.close();
}
