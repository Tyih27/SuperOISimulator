import assert from "node:assert/strict";
import { SHOP_OFFERS } from "../../src/data.js";
import { SPECIALIST_TRAINING_INCREMENTS } from "../../src/domain/progression.js";
import { buildTestApp } from "./helpers.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct horse battery";

function request(app, options) {
  return app.inject({ ...options, headers: { origin: ORIGIN, ...options.headers } });
}

function sid(response) {
  return response.cookies.find(({ name }) => name === "sid");
}

let now = new Date("2026-08-19T12:00:00.000Z");
const app = await buildTestApp({ config: { idFactory: () => "stable-recruit-id", now: () => now } });
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
  const checkIn = await request(app, {
    method: "POST", url: "/api/v1/progression/daily-check-in", cookies: auth, payload: {},
  });
  assert.equal(checkIn.statusCode, 200);
  assert.equal(checkIn.json().reward.trainingCoins, 1000);
  assert.equal(checkIn.json().profile.currencies.trainingCoins, 2000);
  const duplicateCheckIn = await request(app, {
    method: "POST", url: "/api/v1/progression/daily-check-in", cookies: auth, payload: {},
  });
  assert.equal(duplicateCheckIn.statusCode, 409);
  assert.equal(duplicateCheckIn.json().code, "DAILY_CHECK_IN_ALREADY_CLAIMED");
  await app.db.query(
    "UPDATE player_profiles SET payload = jsonb_set(payload, '{inventory,specialist-book-dynamicProgramming}', '1'::jsonb) WHERE account_id = $1",
    [before.accountId],
  );

  const training = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "planner", ability: "dynamicProgramming" },
  });
  assert.equal(training.statusCode, 200);
  assert.equal(training.json().profile.students.planner.abilities.dynamicProgramming, abilityBefore + SPECIALIST_TRAINING_INCREMENTS[before.students.planner.aptitude]);
  assert.equal(training.json().profile.inventory["specialist-book-dynamicProgramming"], 0);

  const purchase = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: " daily-dp-book " },
  });
  assert.equal(purchase.statusCode, 200);
  const coinsAfterFirstPurchase = purchase.json().profile.currencies.trainingCoins;
  assert.equal(purchase.json().profile.inventory["specialist-book-dynamicProgramming"], 1);

  const repeatPurchase = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "daily-dp-book" },
  });
  assert.equal(repeatPurchase.statusCode, 200, "shop offers can be purchased without limits");
  assert.equal(repeatPurchase.json().profile.currencies.trainingCoins, coinsAfterFirstPurchase - 120);
  assert.equal(repeatPurchase.json().profile.inventory["specialist-book-dynamicProgramming"], 2);
  const dpOffer = SHOP_OFFERS.find((offer) => offer.id === "daily-dp-book");
  assert.equal(dpOffer.purchaseLimit, undefined);

  const recruitmentRight = await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth, payload: { offerId: "recruitment-right" } });
  assert.equal(recruitmentRight.statusCode, 200);
  assert.equal(recruitmentRight.json().profile.currencies.trainingCoins, repeatPurchase.json().profile.currencies.trainingCoins - 300);
  assert.equal(recruitmentRight.json().profile.currencies.recruitmentTickets, 2);
  await app.db.query("UPDATE player_profiles SET payload = jsonb_set(payload, '{recruitment,attemptsSinceGenius}', '29'::jsonb) WHERE account_id = $1", [before.accountId]);

  const recruitment = await request(app, { method: "POST", url: "/api/v1/progression/recruitment", cookies: auth, payload: {} });
  assert.equal(recruitment.statusCode, 200);
  assert.equal(Object.keys(recruitment.json().profile.students).length, 4);
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
  const graphistAbilityBefore = dismissed.json().profile.students.graphist.abilities.graphTheory;

  const materialTraining = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "graphist", ability: "graphTheory" },
  });
  assert.equal(materialTraining.statusCode, 200);
  assert.equal(materialTraining.json().training.itemId, "student-training-material");
  assert.equal(materialTraining.json().training.previousValue, graphistAbilityBefore);
  assert.equal(materialTraining.json().training.currentValue, graphistAbilityBefore + SPECIALIST_TRAINING_INCREMENTS.普通);
  assert.equal(materialTraining.json().training.increment, SPECIALIST_TRAINING_INCREMENTS.普通);
  assert.equal(materialTraining.json().profile.students.graphist.abilities.graphTheory, graphistAbilityBefore + SPECIALIST_TRAINING_INCREMENTS.普通);
  assert.equal(materialTraining.json().profile.inventory["student-training-material"], 0);
  const failedTraining = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "graphist", ability: "graphTheory" },
  });
  assert.equal(failedTraining.statusCode, 400);
  assert.match(failedTraining.json().message, /training book or student training material/);
  const afterFailedTraining = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth });
  assert.equal(afterFailedTraining.json().version, materialTraining.json().profile.version);

  now = new Date("2026-08-20T16:01:00.000Z");
  const profileBeforeCheckIn = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth });
  const coinsBeforeCheckIn = profileBeforeCheckIn.json().currencies.trainingCoins;
  const nextDayCheckIn = await request(app, {
    method: "POST", url: "/api/v1/progression/daily-check-in", cookies: auth, payload: {},
  });
  assert.equal(nextDayCheckIn.statusCode, 200);
  assert.equal(nextDayCheckIn.json().profile.currencies.trainingCoins, coinsBeforeCheckIn + 1000);

  const protectedDismissal = await request(app, {
    method: "POST", url: "/api/v1/progression/students/planner/dismiss", cookies: auth,
    payload: {},
  });
  assert.equal(protectedDismissal.statusCode, 400);
  assert.match(protectedDismissal.json().message, /formation student/);

  const profileForBench = await app.inject({ method: "GET", url: "/api/v1/profile", cookies: auth });
  assert.equal(profileForBench.statusCode, 200);
  const savedBench = await request(app, {
    method: "PUT", url: "/api/v1/profile", cookies: auth,
    payload: { version: profileForBench.json().version, formation: { A1: "structurer", A2: "graphist", A3: null } },
  });
  assert.equal(savedBench.statusCode, 200);
  const starterDismissal = await request(app, {
    method: "POST", url: "/api/v1/progression/students/planner/dismiss", cookies: auth,
    payload: {},
  });
  assert.equal(starterDismissal.statusCode, 200);
  assert.equal(starterDismissal.json().profile.students.planner, undefined);
  assert.equal(starterDismissal.json().profile.inventory["student-training-material"], 1);

  const benchGraphist = await request(app, {
    method: "PUT", url: "/api/v1/profile", cookies: auth,
    payload: { version: starterDismissal.json().profile.version, formation: { A1: "structurer", A2: null, A3: null } },
  });
  assert.equal(benchGraphist.statusCode, 200);
  const secondTicket = await request(app, { method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth, payload: { offerId: "recruitment-right" } });
  assert.equal(secondTicket.statusCode, 200);
  const secondRecruit = await request(app, { method: "POST", url: "/api/v1/progression/recruitment", cookies: auth, payload: {} });
  assert.equal(secondRecruit.statusCode, 200);
  const newRecruitId = secondRecruit.json().student.id;
  const batchDismissal = await request(app, {
    method: "POST", url: "/api/v1/progression/students/dismiss-batch", cookies: auth,
    payload: { studentIds: ["graphist", newRecruitId] },
  });
  assert.equal(batchDismissal.statusCode, 200);
  assert.equal(batchDismissal.json().profile.students.graphist, undefined);
  assert.equal(batchDismissal.json().profile.students[newRecruitId], undefined);
  assert.deepEqual(batchDismissal.json().dismissal.studentIds.sort(), [newRecruitId, "graphist"].sort());
  assert.equal(batchDismissal.json().dismissal.quantity, 2);
  assert.equal(batchDismissal.json().profile.inventory["student-training-material"], 3);
  const invalidBatch = await request(app, {
    method: "POST", url: "/api/v1/progression/students/dismiss-batch", cookies: auth,
    payload: { studentIds: ["structurer"] },
  });
  assert.equal(invalidBatch.statusCode, 400);
  assert.match(invalidBatch.json().message, /cannot be dismissed/);
  const oversizedBatch = await request(app, {
    method: "POST", url: "/api/v1/progression/students/dismiss-batch", cookies: auth,
    payload: { studentIds: Array.from({ length: 60 }, (_, index) => `ghost-${index}`) },
  });
  assert.equal(oversizedBatch.statusCode, 400);
  assert.match(oversizedBatch.json().message, /owned by the profile/, "batches beyond 50 students must still reach domain validation");

  const unknownOffer = await request(app, {
    method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth,
    payload: { offerId: "not-a-real-offer" },
  });
  assert.equal(unknownOffer.statusCode, 400);
  assert.equal(unknownOffer.json().message, "Unknown shop offer");

  const currencyEntries = await app.db.query("SELECT currency, delta, source_type FROM currency_ledger ORDER BY id");
  assert.deepEqual(currencyEntries.rows.map(({ currency, delta, source_type: sourceType }) => [currency, delta, sourceType]), [
    ["trainingCoins", 1000, "daily-check-in"],
    ["trainingCoins", -120, "shop"],
    ["trainingCoins", -120, "shop"],
    ["trainingCoins", -300, "shop"],
    ["recruitmentTickets", 1, "shop"],
    ["recruitmentTickets", -1, "recruitment"],
    ["trainingCoins", -100, "specialist-training"],
    ["trainingCoins", 1000, "daily-check-in"],
    ["trainingCoins", -300, "shop"],
    ["recruitmentTickets", 1, "shop"],
    ["recruitmentTickets", -1, "recruitment"],
  ]);
  const inventoryEntries = await app.db.query("SELECT item_id, quantity, source_type FROM inventory_entries ORDER BY id");
  assert.deepEqual(inventoryEntries.rows.map(({ item_id: itemId, quantity, source_type: sourceType }) => [itemId, quantity, sourceType]), [
    ["specialist-book-dynamicProgramming", 1, "shop"],
    ["specialist-book-dynamicProgramming", 1, "shop"],
    ["student-training-material", 1, "student-dismissal"],
    ["student-training-material", 1, "student-dismissal"],
    ["student-training-material", 2, "student-dismissal"],
  ]);
  const auditEntries = await app.db.query("SELECT action_type FROM account_audit_log ORDER BY id");
  assert.deepEqual(auditEntries.rows.map(({ action_type: actionType }) => actionType), [
    "daily_check_in", "specialist_training", "shop_purchase", "shop_purchase", "shop_purchase", "student_recruitment", "student_dismissal", "specialist_training", "daily_check_in", "profile_update", "student_dismissal", "profile_update", "shop_purchase", "student_recruitment", "student_dismissal",
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
