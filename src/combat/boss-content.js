import { createArenaLevel } from "./arena-content.js";

export const BOSS_MAX_ROUNDS = 30;
export const BOSS_MAX_PROGRESS = 1_000_000_000;
export const BOSS_ATTACK_DAMAGE_MULTIPLIER = 0.6;

/** Build the immutable single-problem boss level. Difficulty tracks team power while its attack is tuned down. */
export function createBossLevel({ seed = "boss", targetPower = 1 } = {}) {
  if (typeof seed !== "string" && typeof seed !== "number") throw new TypeError("Boss content seed must be a string or number");
  if (!Number.isFinite(targetPower) || targetPower < 0) throw new TypeError("Boss target power must be non-negative");
  const base = createArenaLevel({ seed, targetPower, topicCount: 1 });
  return {
    ...base,
    id: "boss-rush",
    name: "BOSS挑战",
    maxRounds: BOSS_MAX_ROUNDS,
    objective: { type: "all", requiredTopics: 1 },
    topics: base.topics.map((topic) => ({
      ...topic,
      maxProgress: BOSS_MAX_PROGRESS,
      skill: {
        id: "boss-attack",
        name: "BOSS压制",
        category: "problem",
        effectType: "energyDamage",
        targetRule: "random",
        damageMultiplier: BOSS_ATTACK_DAMAGE_MULTIPLIER,
      },
    })),
  };
}

/** Apply the immutable boss level to a battle snapshot without mutating the input. */
export function withBossLevel(snapshot, level, seed) {
  if (!snapshot || !level) throw new TypeError("Boss snapshot and level are required");
  if (typeof seed !== "string" && typeof seed !== "number") throw new TypeError("Boss snapshot seed must be a string or number");
  const next = structuredClone(snapshot);
  next.level = structuredClone(level);
  next.seed = seed;
  return next;
}
