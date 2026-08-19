import { ABILITY_KEYS, APTITUDE_ABILITY_RANGES, STUDENTS } from "../data.js";
import { createStudentIdentity } from "./student-identity.js";

export const SPECIALIST_TRAINING_COST = 100;
export const SPECIALIST_TRAINING_INCREMENT = 40;
export const MAX_TRAINED_ABILITY = 2_000;

export function specialistTrainingBookId(ability) {
  if (!ABILITY_KEYS.includes(ability)) throw new Error("Unknown ability for specialist training");
  return `specialist-book-${ability}`;
}

function requireProfile(profile) {
  if (!profile?.students || !profile.currencies || !profile.inventory) throw new Error("A complete player profile is required");
}

export function applySpecialistTraining(profile, { studentId, ability } = {}) {
  requireProfile(profile);
  if (!ABILITY_KEYS.includes(ability)) throw new Error("Unknown ability for specialist training");
  const student = profile.students[studentId];
  if (!student) throw new Error("Student must be owned by the profile");
  const bookId = specialistTrainingBookId(ability);
  if ((profile.inventory[bookId] ?? 0) < 1) throw new Error("A matching specialist training book is required");
  if ((profile.currencies.trainingCoins ?? 0) < SPECIALIST_TRAINING_COST) {
    throw new Error("Not enough training coins");
  }
  if (student.abilities[ability] + SPECIALIST_TRAINING_INCREMENT > MAX_TRAINED_ABILITY) {
    throw new Error("Ability has reached the training cap");
  }

  const next = structuredClone(profile);
  next.students[studentId].abilities[ability] += SPECIALIST_TRAINING_INCREMENT;
  next.currencies.trainingCoins -= SPECIALIST_TRAINING_COST;
  next.inventory[bookId] -= 1;
  return next;
}

export function createRecruitedStudent({ studentId, seed, namePoolVersion, templateId, aptitude = "普通" } = {}) {
  const template = STUDENTS.find((student) => student.id === templateId);
  if (!template) throw new Error("Unknown recruitment template");
  if (!APTITUDE_ABILITY_RANGES[aptitude]) throw new Error("Unknown recruited student aptitude");
  const identity = createStudentIdentity({
    studentId: templateId,
    seed,
    namePoolVersion,
    aptitude,
  });
  return {
    ...identity,
    id: studentId,
    maxEnergy: template.maxEnergy,
    skillLevels: { normal: 1, burst: 1 },
    skills: structuredClone(template.skills),
  };
}
