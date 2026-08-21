import { ABILITY_KEYS, TOPICS } from "../data.js";
import { createRng } from "../rng.js";

const ARENA_TOPIC_COUNT = 3;
const ARENA_MAX_ROUNDS = 12;
const ACTIVE_SLOTS = ["B1", "B2", "B3"];

const clone = (value) => structuredClone(value);

function topicDifficultyTotal(topic) {
  return ABILITY_KEYS.reduce((sum, key) => sum + Math.max(0, Number(topic.difficulties?.[key] ?? 0)), 0);
}

function scaleTopic(topic, target, rng) {
  const sourceTotal = topicDifficultyTotal(topic);
  const difficulty = Object.fromEntries(ABILITY_KEYS.map((key) => [key, 0]));
  if (sourceTotal <= 0) return { ...clone(topic), difficulties: difficulty };

  const targetTotal = Math.max(1, Math.round(target * (0.9 + rng.next() * 0.2)));
  let assigned = 0;
  let largestKey = ABILITY_KEYS[0];
  for (const key of ABILITY_KEYS) {
    const source = Math.max(0, Number(topic.difficulties?.[key] ?? 0));
    difficulty[key] = Math.max(0, Math.round((source / sourceTotal) * targetTotal));
    assigned += difficulty[key];
    if (source > (topic.difficulties?.[largestKey] ?? 0)) largestKey = key;
  }
  difficulty[largestKey] = Math.max(0, difficulty[largestKey] + targetTotal - assigned);
  return { ...clone(topic), difficulties: difficulty };
}

/** Build the immutable content shared by both sides of an arena match. */
export function createArenaLevel({ seed = "arena", targetPower = 1, topicCount = ARENA_TOPIC_COUNT } = {}) {
  if (typeof seed !== "string" && typeof seed !== "number") throw new TypeError("Arena content seed must be a string or number");
  if (!Number.isFinite(targetPower) || targetPower < 0) throw new TypeError("Arena target power must be non-negative");
  const count = Math.max(1, Math.min(Number(topicCount) || ARENA_TOPIC_COUNT, TOPICS.length));
  const rng = createRng(`${seed}:topics`);
  const pool = TOPICS.map(clone);
  const selected = [];
  while (selected.length < count) selected.push(pool.splice(Math.floor(rng.next() * pool.length), 1)[0]);
  const topics = selected.map((topic) => scaleTopic(topic, targetPower, rng));
  const topicIds = topics.map((topic) => topic.id);

  return {
    id: "arena-random",
    name: "随机竞技场",
    maxRounds: ARENA_MAX_ROUNDS,
    objective: { type: "count", requiredTopics: Math.min(2, topics.length) },
    topicIds,
    activeTopicSlots: [...ACTIVE_SLOTS],
    studentSlots: ["A1", "A2", "A3"],
    focusMax: 1000,
    focusGain: 200,
    seed,
    topics,
  };
}

export function withArenaLevel(snapshot, level, seed) {
  if (!snapshot || !level) throw new TypeError("Arena snapshot and level are required");
  if (typeof seed !== "string" && typeof seed !== "number") throw new TypeError("Arena snapshot seed must be a string or number");
  const next = clone(snapshot);
  next.level = clone(level);
  next.seed = seed;
  return next;
}

export { ARENA_TOPIC_COUNT };
