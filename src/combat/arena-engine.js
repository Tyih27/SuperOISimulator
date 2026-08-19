import { createHash } from "node:crypto";
import { ENGINE_VERSION, RULESET_VERSION } from "../data.js";
import { CombatEngine } from "./engine.js";
import { serializeEvents } from "./events.js";

const ARENA_RULESET_VERSION = "1";

function clone(value) {
  return structuredClone(value);
}

function hashEvents(events) {
  return createHash("sha256").update(serializeEvents(events)).digest("hex");
}

function sideScore(result) {
  return {
    completedCount: result.completedCount,
    remainingEnergy: result.remainingEnergy,
    round: result.round,
  };
}

function chooseWinner(attacker, defender) {
  const attackerWin = attacker.result === "win";
  const defenderWin = defender.result === "win";
  if (attackerWin && !defenderWin) return "attacker";
  if (defenderWin && !attackerWin) return "defender";
  if (attacker.completedCount !== defender.completedCount) {
    return attacker.completedCount > defender.completedCount ? "attacker" : "defender";
  }
  if (attacker.remainingEnergy !== defender.remainingEnergy) {
    return attacker.remainingEnergy > defender.remainingEnergy ? "attacker" : "defender";
  }
  return "draw";
}

function terminalResult(engine) {
  return engine.status === "ended" ? engine.getResult() : null;
}

/**
 * Run two immutable combat snapshots in lockstep. Each CombatEngine owns its
 * side's state; the arena only advances the paired phase and settles terminal
 * outcomes after both sides have had the same phase opportunity.
 */
export function runArena({ attackerSnapshot, defenderSnapshot, seed = "arena-1" } = {}) {
  if (!attackerSnapshot || !defenderSnapshot) throw new Error("Both arena snapshots are required");
  if (typeof seed !== "string" && typeof seed !== "number") throw new Error("Arena seed must be a string or number");

  const attackerInput = clone(attackerSnapshot);
  const defenderInput = clone(defenderSnapshot);
  attackerInput.seed = `${seed}:attacker`;
  defenderInput.seed = `${seed}:defender`;
  const attackerEngine = CombatEngine.fromSnapshot(attackerInput);
  const defenderEngine = CombatEngine.fromSnapshot(defenderInput);

  let attackerResult = null;
  let defenderResult = null;
  let stageCount = 0;
  const stageLimit = Math.max(attackerEngine.maxRounds, defenderEngine.maxRounds) * 6 + 2;

  while (stageCount < stageLimit && (!attackerResult || !defenderResult)) {
    if (!attackerResult) {
      attackerEngine.step();
      attackerResult = terminalResult(attackerEngine);
    }
    if (!defenderResult) {
      defenderEngine.step();
      defenderResult = terminalResult(defenderEngine);
    }
    stageCount += 1;
    if (attackerResult && defenderResult) break;
  }

  if (!attackerResult) attackerResult = attackerEngine.run();
  if (!defenderResult) defenderResult = defenderEngine.run();

  const winner = chooseWinner(attackerResult, defenderResult);
  return {
    arenaEngineVersion: ENGINE_VERSION,
    arenaRulesetVersion: ARENA_RULESET_VERSION,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    seed,
    winner,
    reason: attackerResult.result === "win" && defenderResult.result === "win"
      ? "simultaneous-completion-tiebreak"
      : attackerResult.reason === "round-limit" && defenderResult.reason === "round-limit"
        ? "round-limit-score-tiebreak"
        : "terminal-result",
    attacker: {
      result: attackerResult.result,
      reason: attackerResult.reason,
      round: attackerResult.round,
      completedCount: attackerResult.completedCount,
      remainingEnergy: attackerResult.remainingEnergy,
      score: sideScore(attackerResult),
      events: clone(attackerResult.events),
      eventsHash: hashEvents(attackerResult.events),
      state: clone(attackerResult.state),
    },
    defender: {
      result: defenderResult.result,
      reason: defenderResult.reason,
      round: defenderResult.round,
      completedCount: defenderResult.completedCount,
      remainingEnergy: defenderResult.remainingEnergy,
      score: sideScore(defenderResult),
      events: clone(defenderResult.events),
      eventsHash: hashEvents(defenderResult.events),
      state: clone(defenderResult.state),
    },
  };
}

export { ARENA_RULESET_VERSION };
