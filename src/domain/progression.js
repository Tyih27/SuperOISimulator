import {
  ABILITY_KEYS,
  APTITUDE_ABILITY_RANGES,
  APTITUDE_ORDER,
  RECRUITMENT_APTITUDE_WEIGHTS,
  RECRUITMENT_PITY_LIMIT,
  SKILL_GROUPS,
  STUDENTS,
} from "../data.js";
import { createStudentIdentity } from "./student-identity.js";
import { createRng } from "../rng.js";

export const SPECIALIST_TRAINING_COST = 100;
// Higher aptitudes also grow faster: each specialist training session adds
// the increment of the student's own aptitude, so aptitude gaps widen over
// time instead of being trained away.
export const SPECIALIST_TRAINING_INCREMENTS = Object.freeze({
  "普通": 15,
  "优秀": 20,
  "稀有": 25,
  "天才": 30,
  "顶尖": 40,
});
export const STUDENT_TRAINING_MATERIAL_ID = "student-training-material";
export const STUDENT_DISMISSAL_MATERIAL_REWARD = 1;

function requireRoll(roll) {
  if (typeof roll !== "number" || !Number.isFinite(roll) || roll < 0 || roll >= 1) {
    throw new Error("Recruitment roll must be a number from 0 (inclusive) to 1 (exclusive)");
  }
  return roll;
}

function requirePityCount(attemptsSinceGenius) {
  if (!Number.isInteger(attemptsSinceGenius) || attemptsSinceGenius < 0 || attemptsSinceGenius >= RECRUITMENT_PITY_LIMIT) {
    throw new Error("Recruitment pity count must be an integer from 0 to 29");
  }
  return attemptsSinceGenius;
}

export function selectRecruitmentAptitude({ roll, attemptsSinceGenius = 0 } = {}) {
  const normalizedRoll = requireRoll(roll);
  const pityCount = requirePityCount(attemptsSinceGenius);
  const isPityAttempt = pityCount + 1 >= RECRUITMENT_PITY_LIMIT;
  let aptitude;
  if (isPityAttempt) {
    aptitude = "天才";
  } else {
    let cumulative = 0;
    aptitude = APTITUDE_ORDER.find((candidate) => {
      cumulative += RECRUITMENT_APTITUDE_WEIGHTS[candidate];
      return normalizedRoll < cumulative;
    }) ?? "顶尖";
  }
  const aptitudeRank = APTITUDE_ORDER.indexOf(aptitude);
  const geniusRank = APTITUDE_ORDER.indexOf("天才");
  return {
    aptitude,
    attemptsSinceGenius: aptitudeRank >= geniusRank ? 0 : pityCount + 1,
  };
}

export function rollRecruitmentAptitude({ seed, attemptsSinceGenius = 0 } = {}) {
  if (typeof seed !== "string" && typeof seed !== "number") {
    throw new Error("Recruitment seed must be a string or number");
  }
  const rng = createRng(`${seed}:recruitment-aptitude`);
  return selectRecruitmentAptitude({ roll: rng.next(), attemptsSinceGenius });
}

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
  const increment = SPECIALIST_TRAINING_INCREMENTS[student.aptitude];
  if (!increment) throw new Error("Unknown student aptitude");
  const bookId = specialistTrainingBookId(ability);
  const usesBook = (profile.inventory[bookId] ?? 0) > 0;
  const itemId = usesBook ? bookId : STUDENT_TRAINING_MATERIAL_ID;
  if ((profile.inventory[itemId] ?? 0) < 1) throw new Error("A matching specialist training book or student training material is required");
  if (!usesBook && (profile.currencies.trainingCoins ?? 0) < SPECIALIST_TRAINING_COST) {
    throw new Error("Not enough training coins");
  }

  const next = structuredClone(profile);
  next.students[studentId].abilities[ability] += increment;
  if (!usesBook) next.currencies.trainingCoins -= SPECIALIST_TRAINING_COST;
  next.inventory[itemId] -= 1;
  return next;
}

export function createRecruitedStudent({ studentId, seed, namePoolVersion, templateId, aptitude = "普通" } = {}) {
  const template = STUDENTS.find((student) => student.id === templateId);
  if (!template) throw new Error("Unknown recruitment template");
  if (!SKILL_GROUPS[template.skillGroupId]) throw new Error("Recruitment template has an unknown skill group");
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
    skillGroupId: template.skillGroupId,
    skillGroupLevels: { [template.skillGroupId]: { normal: 1, burst: 1 } },
  };
}

export function dismissStudent(profile, { studentId } = {}) {
  requireProfile(profile);
  if (typeof studentId !== "string" || studentId.trim() === "") {
    throw new Error("Student id is required");
  }
  const student = profile.students[studentId];
  if (!student) throw new Error("Student must be owned by the profile");
  if (Object.values(profile.formation ?? {}).includes(studentId)) {
    throw new Error("A formation student cannot be dismissed");
  }

  const next = structuredClone(profile);
  delete next.students[studentId];
  next.inventory[STUDENT_TRAINING_MATERIAL_ID] =
    (next.inventory[STUDENT_TRAINING_MATERIAL_ID] ?? 0) + STUDENT_DISMISSAL_MATERIAL_REWARD;
  return next;
}

export function dismissStudents(profile, { studentIds = [] } = {}) {
  requireProfile(profile);
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    throw new Error("At least one student must be selected for dismissal");
  }
  if (new Set(studentIds).size !== studentIds.length) {
    throw new Error("Duplicate students in the dismissal list");
  }
  for (const studentId of studentIds) {
    if (typeof studentId !== "string" || !profile.students[studentId]) {
      throw new Error(`Student ${studentId} must be owned by the profile`);
    }
    if (Object.values(profile.formation ?? {}).includes(studentId)) {
      throw new Error(`Formation student ${studentId} cannot be dismissed`);
    }
  }

  const next = structuredClone(profile);
  for (const studentId of studentIds) delete next.students[studentId];
  next.inventory[STUDENT_TRAINING_MATERIAL_ID] =
    (next.inventory[STUDENT_TRAINING_MATERIAL_ID] ?? 0) + STUDENT_DISMISSAL_MATERIAL_REWARD * studentIds.length;
  return next;
}
