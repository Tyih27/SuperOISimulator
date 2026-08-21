import assert from "node:assert/strict";
import { ABILITY_KEYS, APTITUDE_ABILITY_RANGES, APTITUDE_ORDER, LEVELS, RECRUITMENT_PITY_LIMIT, SHOP_OFFERS, STUDENTS } from "../data.js";
import {
  applyEnergyTonic,
  applySpecialistTraining,
  createRecruitedStudent,
  dismissStudent,
  dismissStudents,
  ENERGY_TONIC_ID,
  ENERGY_TONIC_MAX_ENERGY_GAIN,
  selectRecruitmentAptitude,
  SPECIALIST_TRAINING_INCREMENTS,
  STUDENT_TRAINING_MATERIAL_ID,
  specialistTrainingBookId,
} from "../domain/progression.js";
import { createProfile } from "../domain/profile.js";
import { createBattleSnapshot } from "../domain/snapshot.js";

assert.ok(LEVELS.length >= 3 && LEVELS.length <= 12, "the campaign must ship with 3-12 levels");
assert.deepEqual(LEVELS.map((level) => level.order), [...LEVELS.keys()].map((index) => index + 1));
assert.ok(LEVELS.some((level) => level.objective.type === "count"));
assert.ok(LEVELS.some((level) => level.objective.type === "all"));
assert.equal(SHOP_OFFERS.filter((offer) => offer.purchaseLimit).length, 0);
assert.equal(SHOP_OFFERS.find((offer) => offer.id === "recruitment-right").grants.recruitmentTickets, 1);

for (const key of ABILITY_KEYS) {
  for (let index = 1; index < APTITUDE_ORDER.length; index += 1) {
    const previous = APTITUDE_ABILITY_RANGES[APTITUDE_ORDER[index - 1]][key];
    const current = APTITUDE_ABILITY_RANGES[APTITUDE_ORDER[index]][key];
    assert.ok(
      current[0] >= previous[0] && current[1] > previous[1] && current[0] >= previous[1],
      `${APTITUDE_ORDER[index]} must dominate ${APTITUDE_ORDER[index - 1]} on ${key}`,
    );
  }
}
for (const student of STUDENTS) {
  for (const key of ABILITY_KEYS) {
    const [minimum, maximum] = APTITUDE_ABILITY_RANGES[student.defaultAptitude][key];
    const value = student.abilities[key];
    assert.ok(value >= minimum && value <= maximum, `${student.id} ${key} must sit inside its aptitude range`);
  }
}
assert.deepEqual(Object.keys(SPECIALIST_TRAINING_INCREMENTS), [...APTITUDE_ORDER]);
for (let index = 1; index < APTITUDE_ORDER.length; index += 1) {
  assert.ok(
    SPECIALIST_TRAINING_INCREMENTS[APTITUDE_ORDER[index]] > SPECIALIST_TRAINING_INCREMENTS[APTITUDE_ORDER[index - 1]],
    "higher aptitudes must train faster",
  );
}

assert.equal(selectRecruitmentAptitude({ roll: 0, attemptsSinceGenius: 0 }).aptitude, "普通");
assert.equal(selectRecruitmentAptitude({ roll: 0.95, attemptsSinceGenius: 0 }).aptitude, "稀有");
assert.equal(selectRecruitmentAptitude({ roll: 0, attemptsSinceGenius: RECRUITMENT_PITY_LIMIT - 1 }).aptitude, "天才");
assert.equal(selectRecruitmentAptitude({ roll: 0, attemptsSinceGenius: RECRUITMENT_PITY_LIMIT - 1 }).attemptsSinceGenius, 0);
assert.equal(selectRecruitmentAptitude({ roll: 0.9995, attemptsSinceGenius: 0 }).attemptsSinceGenius, 0, "top aptitude also satisfies the genius pity");
assert.equal(selectRecruitmentAptitude({ roll: 0, attemptsSinceGenius: 3 }).attemptsSinceGenius, 4);

const profile = createProfile({
  accountId: "progression-profile",
  studentIds: ["planner", "graphist", "structurer"],
  formation: { A1: "planner", A2: "graphist", A3: "structurer" },
  inventory: { [specialistTrainingBookId("dynamicProgramming")]: 1 },
  currencies: { trainingCoins: 200, recruitmentTickets: 0 },
});
const abilityBefore = profile.students.planner.abilities.dynamicProgramming;
const plannerIncrement = SPECIALIST_TRAINING_INCREMENTS[profile.students.planner.aptitude];
const trained = applySpecialistTraining(profile, { studentId: "planner", ability: "dynamicProgramming" });
assert.equal(trained.students.planner.abilities.dynamicProgramming, abilityBefore + plannerIncrement);
assert.equal(trained.currencies.trainingCoins, 200, "training with a specialist book must not charge training coins");
assert.equal(trained.inventory[specialistTrainingBookId("dynamicProgramming")], 0);
assert.equal(profile.students.planner.abilities.dynamicProgramming, abilityBefore, "training must not mutate the supplied profile");
assert.throws(
  () => applySpecialistTraining({ ...profile, inventory: { [STUDENT_TRAINING_MATERIAL_ID]: 1 }, currencies: { trainingCoins: 50, recruitmentTickets: 0 } }, { studentId: "planner", ability: "dynamicProgramming" }),
  /training coins/,
);
const materialTrained = applySpecialistTraining(
  { ...structuredClone(profile), inventory: { [STUDENT_TRAINING_MATERIAL_ID]: 1 } },
  { studentId: "planner", ability: "dynamicProgramming" },
);
assert.equal(materialTrained.currencies.trainingCoins, 100, "material-based training must still charge training coins");
assert.equal(materialTrained.inventory[STUDENT_TRAINING_MATERIAL_ID], 0);

const tonicProfile = structuredClone(profile);
tonicProfile.inventory[ENERGY_TONIC_ID] = 1;
const maxEnergyBefore = tonicProfile.students.planner.maxEnergy;
const energized = applyEnergyTonic(tonicProfile, { studentId: "planner" });
assert.equal(energized.students.planner.maxEnergy, maxEnergyBefore + ENERGY_TONIC_MAX_ENERGY_GAIN);
assert.equal(energized.inventory[ENERGY_TONIC_ID], 0);
assert.equal(tonicProfile.students.planner.maxEnergy, maxEnergyBefore, "energy tonic must not mutate the supplied profile");
assert.throws(() => applyEnergyTonic(profile, { studentId: "planner" }), /energy tonic/);
assert.throws(() => applyEnergyTonic(tonicProfile, { studentId: "ghost" }), /owned by the profile/);

const recruit = createRecruitedStudent({
  studentId: "recruit-test", seed: "recruit-seed", namePoolVersion: profile.namePoolVersion,
  templateId: "planner", aptitude: "普通",
});
assert.equal(recruit.id, "recruit-test");
assert.ok(ABILITY_KEYS.every((ability) => Number.isInteger(recruit.abilities[ability])));
const expanded = structuredClone(profile);
expanded.students[recruit.id] = recruit;
const snapshot = createBattleSnapshot(expanded, {
  teamIds: ["planner", "graphist", recruit.id],
  formation: { A1: "planner", A2: "graphist", A3: recruit.id },
  timestamp: "2026-08-19T00:00:00.000Z",
});
assert.equal(snapshot.team[2].id, recruit.id, "recruited students must be eligible for a three-student battle");

const dismissalProfile = structuredClone(profile);
dismissalProfile.students[recruit.id] = recruit;
const dismissed = dismissStudent(dismissalProfile, { studentId: recruit.id });
assert.equal(dismissed.students[recruit.id], undefined);
assert.equal(dismissed.inventory[STUDENT_TRAINING_MATERIAL_ID], 1);
const materialTraining = applySpecialistTraining({
  ...structuredClone(profile),
  inventory: { [STUDENT_TRAINING_MATERIAL_ID]: 1 },
}, { studentId: "planner", ability: "dynamicProgramming" });
assert.equal(materialTraining.students.planner.abilities.dynamicProgramming, abilityBefore + plannerIncrement);
assert.equal(materialTraining.inventory[STUDENT_TRAINING_MATERIAL_ID], 0);

const eliteRecruit = createRecruitedStudent({
  studentId: "recruit-elite", seed: "elite-seed", namePoolVersion: profile.namePoolVersion,
  templateId: "planner", aptitude: "天才",
});
const eliteProfile = structuredClone(profile);
eliteProfile.students[eliteRecruit.id] = eliteRecruit;
eliteProfile.inventory[specialistTrainingBookId("dynamicProgramming")] = 1;
const eliteAbilityBefore = eliteProfile.students[eliteRecruit.id].abilities.dynamicProgramming;
const eliteTrained = applySpecialistTraining(eliteProfile, { studentId: eliteRecruit.id, ability: "dynamicProgramming" });
assert.equal(
  eliteTrained.students[eliteRecruit.id].abilities.dynamicProgramming,
  eliteAbilityBefore + SPECIALIST_TRAINING_INCREMENTS["天才"],
  "training increment must follow the student's own aptitude",
);
assert.throws(
  () => applySpecialistTraining({ ...profile, inventory: {} }, { studentId: "planner", ability: "dynamicProgramming" }),
  /training book or student training material/,
);
assert.throws(() => dismissStudent(profile, { studentId: "planner" }), /formation student/);
const benchStarterProfile = structuredClone(dismissalProfile);
benchStarterProfile.formation = { A1: "graphist", A2: "structurer", A3: recruit.id };
const dismissedStarter = dismissStudent(benchStarterProfile, { studentId: "planner" });
assert.equal(dismissedStarter.students.planner, undefined, "starter students on the bench must be dismissible");
assert.equal(dismissedStarter.inventory[STUDENT_TRAINING_MATERIAL_ID], 1);
assert.throws(
  () => dismissStudent({ ...dismissalProfile, formation: { A1: recruit.id, A2: "graphist", A3: "structurer" } }, { studentId: recruit.id }),
  /formation student/,
);

const batchProfile = createProfile({
  accountId: "batch-profile",
  studentIds: ["planner"],
  formation: { A1: "planner", A2: null, A3: null },
});
const rareBatchRecruit = createRecruitedStudent({ studentId: "batch-rare", seed: "b1", namePoolVersion: profile.namePoolVersion, templateId: "graphist", aptitude: "天才" });
const plainBatchRecruit = createRecruitedStudent({ studentId: "batch-plain", seed: "b2", namePoolVersion: profile.namePoolVersion, templateId: "structurer", aptitude: "普通" });
batchProfile.students[rareBatchRecruit.id] = rareBatchRecruit;
batchProfile.students[plainBatchRecruit.id] = plainBatchRecruit;
assert.throws(() => dismissStudents(batchProfile, { studentIds: [] }), /At least one student/);
assert.throws(() => dismissStudents(batchProfile, { studentIds: ["batch-rare", "batch-rare"] }), /Duplicate students/);
assert.throws(() => dismissStudents(batchProfile, { studentIds: ["planner"] }), /cannot be dismissed/);
assert.throws(() => dismissStudents(batchProfile, { studentIds: ["ghost"] }), /owned by the profile/);
const batchDismissed = dismissStudents(batchProfile, { studentIds: ["batch-rare", "batch-plain"] });
assert.deepEqual(Object.keys(batchDismissed.students), ["planner"]);
assert.equal(batchDismissed.inventory[STUDENT_TRAINING_MATERIAL_ID], 2);

console.log("progression domain tests passed");
