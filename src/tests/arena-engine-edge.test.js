import assert from "node:assert/strict";
import { createBattleSnapshot } from "../domain/snapshot.js";
import { createProfile } from "../domain/profile.js";
import { runArena } from "../combat/arena-engine.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fullProfile = createProfile({
  accountId: "arena-edge",
  studentIds: ["planner", "graphist", "structurer", "mathematician", "implementer", "supporter"],
});

function snapshot({ teamIds = ["planner", "graphist", "structurer"], seed = "fixture" } = {}) {
  return createBattleSnapshot(fullProfile, {
    levelId: "chapter-1-1",
    teamIds,
    formation: { A1: teamIds[0], A2: teamIds[1], A3: teamIds[2] },
    seed,
    timestamp: "2026-08-21T00:00:00.000Z",
  });
}

// ── Error: missing snapshots ─────────────────────────────────────────────────

assert.throws(() => runArena({ attackerSnapshot: null, defenderSnapshot: snapshot() }), /Both arena snapshots/);
assert.throws(() => runArena({ attackerSnapshot: snapshot(), defenderSnapshot: null }), /Both arena snapshots/);
assert.throws(() => runArena({}), /Both arena snapshots/);

// ── Error: invalid seed ──────────────────────────────────────────────────────

assert.throws(
  () => runArena({ attackerSnapshot: snapshot(), defenderSnapshot: snapshot(), seed: null }),
  /Arena seed must be a string or number/,
);
assert.throws(
  () => runArena({ attackerSnapshot: snapshot(), defenderSnapshot: snapshot(), seed: { bad: true } }),
  /Arena seed must be a string or number/,
);

// ── Determinism ──────────────────────────────────────────────────────────────

const attacker = snapshot({ teamIds: ["planner", "graphist", "structurer"], seed: "att" });
const defender = snapshot({ teamIds: ["mathematician", "implementer", "supporter"], seed: "def" });
const first = runArena({ attackerSnapshot: attacker, defenderSnapshot: defender, seed: "arena-e1" });
const second = runArena({ attackerSnapshot: attacker, defenderSnapshot: defender, seed: "arena-e1" });
assert.equal(first.attacker.eventsHash, second.attacker.eventsHash);
assert.equal(first.defender.eventsHash, second.defender.eventsHash);
assert.equal(first.winner, second.winner);

// ── Winner is valid enum ─────────────────────────────────────────────────────

assert.ok(["attacker", "defender", "draw"].includes(first.winner));

// ── Events structure ─────────────────────────────────────────────────────────

assert.equal(first.attacker.events[0].type, "round_start");
assert.equal(first.attacker.events.at(-1).type, "battle_end");
assert.equal(first.defender.events[0].type, "round_start");
assert.equal(first.defender.events.at(-1).type, "battle_end");

// ── Draw: identical snapshots ────────────────────────────────────────────────

const same = snapshot({ teamIds: ["planner", "graphist", "structurer"], seed: "same" });
const tie = runArena({ attackerSnapshot: same, defenderSnapshot: same, seed: "tie-test" });
assert.equal(tie.winner, "draw");

// ── Both sides lose (neither completes goal) ─────────────────────────────────

const weakA = createProfile({ accountId: "weak-a", studentIds: ["planner", "graphist", "structurer"] });
const weakB = createProfile({ accountId: "weak-b", studentIds: ["mathematician", "implementer", "supporter"] });
const weakAttacker = createBattleSnapshot(weakA, {
  levelId: "chapter-1-4",
  teamIds: ["planner", "graphist", "structurer"],
  formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  seed: "weak-a",
  timestamp: "2026-08-21T00:00:00.000Z",
});
const weakDefender = createBattleSnapshot(weakB, {
  levelId: "chapter-1-4",
  teamIds: ["mathematician", "implementer", "supporter"],
  formation: { A1: "mathematician", A2: "implementer", A3: "supporter" },
  seed: "weak-d",
  timestamp: "2026-08-21T00:00:00.000Z",
});
const bothLose = runArena({ attackerSnapshot: weakAttacker, defenderSnapshot: weakDefender, seed: "both-lose" });
assert.ok(["attacker", "defender", "draw"].includes(bothLose.winner));

// ── Score comparison ─────────────────────────────────────────────────────────

assert.ok(typeof first.attacker.score.completedCount === "number");
assert.ok(typeof first.attacker.score.remainingEnergy === "number");
assert.ok(typeof first.attacker.score.round === "number");
assert.ok(typeof first.defender.score.completedCount === "number");

// ── Different seeds produce different hashes ─────────────────────────────────

const diffSeed = runArena({ attackerSnapshot: attacker, defenderSnapshot: defender, seed: "different" });
assert.notEqual(first.attacker.eventsHash, diffSeed.attacker.eventsHash);

// ── Version fields ───────────────────────────────────────────────────────────

assert.ok(first.engineVersion);
assert.ok(first.rulesetVersion);
assert.ok(first.arenaEngineVersion);
assert.ok(first.arenaRulesetVersion);

// ── Reason field ─────────────────────────────────────────────────────────────

assert.ok(typeof first.reason === "string");
assert.ok(first.reason.length > 0);

console.log("arena-engine-edge tests passed");
