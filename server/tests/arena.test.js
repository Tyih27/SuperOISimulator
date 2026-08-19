import assert from "node:assert/strict";
import { createBattleSnapshot } from "../../src/domain/snapshot.js";
import { createProfile } from "../../src/domain/profile.js";
import { runArena } from "../../src/combat/arena-engine.js";

const profile = createProfile({
  accountId: "arena-fixture",
  studentIds: ["planner", "graphist", "structurer", "mathematician", "implementer", "supporter"],
});

function snapshot({ levelId = "chapter-1-1", teamIds = ["planner", "graphist", "structurer"], seed = "fixture" } = {}) {
  return createBattleSnapshot(profile, {
    levelId,
    teamIds,
    formation: { A1: teamIds[0], A2: teamIds[1], A3: teamIds[2] },
    seed,
    timestamp: "2026-08-19T12:00:00.000Z",
  });
}

const attackerSnapshot = snapshot();
const defenderSnapshot = snapshot({ teamIds: ["mathematician", "implementer", "supporter"] });
const first = runArena({ attackerSnapshot, defenderSnapshot, seed: "arena-1" });
const second = runArena({ attackerSnapshot, defenderSnapshot, seed: "arena-1" });

assert.equal(first.attacker.eventsHash, second.attacker.eventsHash);
assert.equal(first.defender.eventsHash, second.defender.eventsHash);
assert.ok(["attacker", "defender", "draw"].includes(first.winner));
assert.equal(first.attacker.events[0].type, "round_start");
assert.equal(first.attacker.events.at(-1).type, "battle_end");

const tie = runArena({ attackerSnapshot, defenderSnapshot: attackerSnapshot, seed: "same" });
assert.equal(tie.winner, "draw");
assert.match(tie.reason, /simultaneous|terminal/);

const limitedAttacker = snapshot({ levelId: "chapter-1-4", seed: "limited" });
const limitedDefender = snapshot({ levelId: "chapter-1-4", teamIds: ["mathematician", "implementer", "supporter"], seed: "limited" });
const limited = runArena({ attackerSnapshot: limitedAttacker, defenderSnapshot: limitedDefender, seed: "round-limit" });
assert.ok(["attacker", "defender", "draw"].includes(limited.winner));
assert.match(limited.reason, /round-limit|terminal/);

console.log("arena engine tests passed");
