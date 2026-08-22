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

let now = new Date("2026-08-20T12:00:00.000Z");
const app = await buildTestApp({ config: { idFactory: () => "stable-refund-id", now: () => now } });

try {
  const registered = await request(app, {
    method: "POST", url: "/api/v1/auth/register", payload: { username: "refund01", password: PASSWORD },
  });
  const auth = { sid: sid(registered).value };

  const checkIn = await request(app, { method: "POST", url: "/api/v1/progression/daily-check-in", cookies: auth, payload: {} });
  assert.equal(checkIn.statusCode, 200);

  // Buy the consumables used for investments.
  for (const offerId of ["daily-graph-book", "daily-dp-book", "energy-tonic"]) {
    const purchase = await request(app, {
      method: "POST", url: "/api/v1/progression/shop/purchases", cookies: auth, payload: { offerId },
    });
    assert.equal(purchase.statusCode, 200, purchase.json().message);
  }

  // Bench two starters so they become dismissible, then invest in them.
  const profileBefore = await request(app, { method: "GET", url: "/api/v1/profile", cookies: auth });
  const benchUpdate = await request(app, {
    method: "PUT", url: "/api/v1/profile", cookies: auth,
    payload: { version: profileBefore.json().version, formation: { A1: "planner", A2: null, A3: null } },
  });
  assert.equal(benchUpdate.statusCode, 200, benchUpdate.json().message);

  const graphTraining = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "graphist", ability: "graphTheory" },
  });
  assert.equal(graphTraining.statusCode, 200, graphTraining.json().message);
  const kfc = await request(app, {
    method: "POST", url: "/api/v1/progression/students/graphist/energy", cookies: auth, payload: {},
  });
  assert.equal(kfc.statusCode, 200, kfc.json().message);
  const dpTraining = await request(app, {
    method: "POST", url: "/api/v1/progression/training/specialist", cookies: auth,
    payload: { studentId: "structurer", ability: "dynamicProgramming" },
  });
  assert.equal(dpTraining.statusCode, 200, dpTraining.json().message);

  // Single dismissal refunds exactly what graphist consumed plus the base reward.
  const dismissed = await request(app, {
    method: "POST", url: "/api/v1/progression/students/graphist/dismiss", cookies: auth, payload: {},
  });
  assert.equal(dismissed.statusCode, 200, dismissed.json().message);
  assert.deepEqual(dismissed.json().dismissal.refunded, {
    "specialist-book-graphTheory": 1,
    "energy-tonic": 1,
  });
  assert.equal(dismissed.json().dismissal.quantity, 1);
  assert.equal(dismissed.json().profile.inventory["specialist-book-graphTheory"], 1);
  assert.equal(dismissed.json().profile.inventory["energy-tonic"], 1);
  assert.equal(dismissed.json().profile.inventory["student-training-material"], 1);

  // The refund must be visible in the inventory ledger (row order is not
  // significant: jsonb object keys do not preserve insertion order).
  const ledgerRows = await app.db.query(
    "SELECT item_id, quantity, source_type FROM inventory_entries WHERE source_type LIKE 'student-dismissal%'",
  );
  assert.deepEqual(
    ledgerRows.rows.map(({ item_id: itemId, quantity, source_type: sourceType }) => [itemId, quantity, sourceType]).sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2])),
    [
      ["student-training-material", 1, "student-dismissal"],
      ["specialist-book-graphTheory", 1, "student-dismissal-refund"],
      ["energy-tonic", 1, "student-dismissal-refund"],
    ].sort((a, b) => a[0].localeCompare(b[0]) || a[2].localeCompare(b[2])),
  );

  // Batch dismissal aggregates refunds across students and keeps one base reward each.
  const batchDismissed = await request(app, {
    method: "POST", url: "/api/v1/progression/students/dismiss-batch", cookies: auth,
    payload: { studentIds: ["structurer"] },
  });
  assert.equal(batchDismissed.statusCode, 200, batchDismissed.json().message);
  assert.deepEqual(batchDismissed.json().dismissal.refunded, { "specialist-book-dynamicProgramming": 1 });
  assert.equal(batchDismissed.json().dismissal.quantity, 1);
  assert.equal(batchDismissed.json().profile.inventory["specialist-book-dynamicProgramming"], 1);
  assert.equal(batchDismissed.json().profile.inventory["student-training-material"], 2);

  // Dismissing an uninvested student reports an empty refund map.
  const plainRecruitment = await request(app, {
    method: "POST", url: "/api/v1/progression/recruitment", cookies: auth, payload: {},
  });
  assert.equal(plainRecruitment.statusCode, 200, plainRecruitment.json().message);
  const plainId = plainRecruitment.json().student.id;
  const plainDismissed = await request(app, {
    method: "POST", url: `/api/v1/progression/students/${encodeURIComponent(plainId)}/dismiss`, cookies: auth, payload: {},
  });
  assert.equal(plainDismissed.statusCode, 200, plainDismissed.json().message);
  assert.deepEqual(plainDismissed.json().dismissal.refunded, {});

  console.log("dismissal refund service tests passed");
} finally {
  await app.close();
}
