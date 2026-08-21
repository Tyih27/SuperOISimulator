/** Pure integer-safe formulas shared by the combat engine and tests. */

import { ABILITY_KEYS } from "../data.js";

export function clamp(value, min, max) {
  if (![value, min, max].every(Number.isFinite) || min > max) {
    throw new TypeError("clamp expects finite values and min <= max");
  }
  return Math.min(max, Math.max(min, value));
}

/** The design document defines round for non-negative values as floor(x + .5). */
export function roundHalfUp(value) {
  if (!Number.isFinite(value)) throw new TypeError("roundHalfUp expects a finite value");
  return Math.floor(value + 0.5);
}

export function average(values) {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function relevantAbilityKeys(topic) {
  return ABILITY_KEYS.filter((key) => (topic.difficulties?.[key] ?? 0) > 0);
}

export function calculateOverallPower(student) {
  return average(ABILITY_KEYS.map((key) => student.abilities?.[key] ?? 0));
}

export function calculateAbilityGap(student, topic) {
  return average(relevantAbilityKeys(topic).map((key) => (student.abilities?.[key] ?? 0) - topic.difficulties[key]));
}

export function calculateBaselineProgress(student, topic) {
  return roundHalfUp(1000 + calculateAbilityGap(student, topic) * 2);
}

export function topicRemainingProgress(topic) {
  return Math.max(0, (topic.maxProgress ?? 0) - (topic.progress ?? 0));
}

export function calculateSkillProgress({ student, topic, skill }) {
  const raw = calculateBaselineProgress(student, topic) * (skill.skillMultiplier ?? 1) * (skill.targetMultiplier ?? 1) + (skill.flatBonus ?? 0);
  return roundHalfUp(raw);
}

export function calculateAverageAbilityShortfall(student, topic) {
  return average(relevantAbilityKeys(topic).map((key) => Math.max(topic.difficulties[key] - (student.abilities?.[key] ?? 0), 0)));
}

export function calculateEnergyDamage(student, topic) {
  return roundHalfUp(500 + calculateAverageAbilityShortfall(student, topic) * 2);
}

export function calculateTopicSkillDamage(student, topic, skill = {}) {
  const base = calculateEnergyDamage(student, topic);
  return roundHalfUp(base * (skill.damageMultiplier ?? 1) + (skill.flatBonus ?? 0));
}

export function relatedAbilityValue(student, relatedAbility = "overall") {
  return relatedAbility === "overall" ? calculateOverallPower(student) : (student.abilities?.[relatedAbility] ?? 0);
}

export function calculateSupportEffect(student, skill) {
  const effect = skill.effect ?? {};
  const raw = (effect.base ?? 0) + relatedAbilityValue(student, skill.relatedAbility) * (effect.multiplier ?? 0);
  return roundHalfUp(raw);
}

export const abilityGap = calculateAbilityGap;
export const baselineProgress = calculateBaselineProgress;
export const skillProgress = calculateSkillProgress;
export const energyDamage = calculateEnergyDamage;
export const topicSkillDamage = calculateTopicSkillDamage;
export const supportEffect = calculateSupportEffect;
