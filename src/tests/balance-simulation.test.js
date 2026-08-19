import assert from "node:assert/strict";
import { BALANCE_BASELINES, BALANCE_BASELINE_TOLERANCE, LEVELS } from "../data.js";
import { STARTER_STUDENT_IDS } from "../domain/profile.js";
import { simulate, toCsv } from "../../scripts/simulate-formations.js";

const options = {
  levelId: "chapter-1-1",
  seeds: [1, 2, 3],
  rosterIds: STARTER_STUDENT_IDS,
};

const report = simulate(options);
const repeatedReport = simulate(options);

assert.deepEqual(report, repeatedReport, "the same simulation input must produce the same report");
assert.equal(report.levelId, "chapter-1-1");
assert.equal(report.formations, 20);
assert.equal(report.permutationsPerFormation, 6);
assert.equal(report.seeds, 3);
assert.equal(report.rows.length, 120);
assert.ok(report.rows.every((row) => (
  row.averageRounds > 0
  && row.winRate >= 0
  && row.winRate <= 1
  && row.averageRemainingEnergy >= 0
  && row.averageCompletedTopics >= 0
  && Number.isInteger(row.normalSkillCount)
  && Number.isInteger(row.burstSkillCount)
)), "every row must contain bounded aggregate metrics");
assert.deepEqual(report.rows[0].positions, { A1: "planner", A2: "graphist", A3: "structurer" });
assert.match(toCsv(report), /^levelId,formation,A1,A2,A3,simulations,winRate,averageRounds/);

assert.deepEqual(Object.keys(BALANCE_BASELINES), LEVELS.map(({ id }) => id), "every campaign level needs an approved baseline");
for (const [levelId, baseline] of Object.entries(BALANCE_BASELINES)) {
  const levelReport = simulate({ levelId, seeds: baseline.seeds, rosterIds: STARTER_STUDENT_IDS });
  const movement = Math.abs(levelReport.overallWinRate - baseline.winRate);
  assert.ok(
    movement <= BALANCE_BASELINE_TOLERANCE,
    `${levelId} win rate moved by ${(movement * 100).toFixed(2)} percentage points; review and update the approved baseline`,
  );
}

console.log(`balance simulation tests passed: ${report.rows.length} deterministic rows`);
