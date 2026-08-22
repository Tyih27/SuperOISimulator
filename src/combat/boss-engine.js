import { createHash } from "node:crypto";
import { ENGINE_VERSION, RULESET_VERSION } from "../data.js";
import { CombatEngine } from "./engine.js";
import { serializeEvents } from "./events.js";

const BOSS_RULESET_VERSION = "1";

function hashEvents(events) {
  return createHash("sha256").update(serializeEvents(events)).digest("hex");
}

/**
 * Run one immutable boss snapshot deterministically. Damage is the progress
 * accumulated on the boss problem; an early wipe still keeps everything dealt.
 */
export function runBoss({ snapshot, seed = "boss-1" } = {}) {
  if (!snapshot) throw new Error("A boss battle snapshot is required");
  if (typeof seed !== "string" && typeof seed !== "number") throw new Error("Boss seed must be a string or number");

  const input = structuredClone(snapshot);
  input.seed = seed;
  const engine = CombatEngine.fromSnapshot(input);
  const result = engine.run();
  const damage = Object.values(result.state.problems).reduce((sum, problem) => sum + problem.progress, 0);

  return {
    bossEngineVersion: ENGINE_VERSION,
    bossRulesetVersion: BOSS_RULESET_VERSION,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    seed,
    result: result.result,
    reason: result.reason,
    round: result.round,
    completedCount: result.completedCount,
    remainingEnergy: result.remainingEnergy,
    damage,
    events: result.events,
    eventsHash: hashEvents(result.events),
    state: result.state,
  };
}

export { BOSS_RULESET_VERSION };
