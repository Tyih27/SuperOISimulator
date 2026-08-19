import { ENGINE_VERSION, RULESET_VERSION } from '../data.js';

export const EVENT_TYPES = Object.freeze([
  'round_start', 'stage_start', 'action', 'skip', 'effect',
  'problem_completed', 'student_exit', 'round_end', 'battle_end',
]);

export function event(type, payload = {}) {
  if (!EVENT_TYPES.includes(type)) throw new Error(`Unknown combat event: ${type}`);
  return { type, ...payload };
}

export function serializeEvents(events) {
  return JSON.stringify({
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
    events,
  });
}

export function serializeBattleResult(result) {
  return JSON.stringify({
    ...result,
    engineVersion: ENGINE_VERSION,
    rulesetVersion: RULESET_VERSION,
  });
}
