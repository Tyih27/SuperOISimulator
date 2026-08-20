import assert from "node:assert/strict";
import { ABILITY_KEYS, LEVELS, RECRUITMENT_PITY_LIMIT, SHOP_OFFERS } from "../data.js";
import {
  applySpecialistTraining,
  createRecruitedStudent,
  dismissRecruitedStudent,
  selectRecruitmentAptitude,
  SPECIALIST_TRAINING_INCREMENT,
  STUDENT_TRAINING_MATERIAL_ID,
  specialistTrainingBookId,
} from "../domain/progression.js";
import { createProfile } from "../domain/profile.js";
import { createBattleSnapshot } from "../domain/snapshot.js";

assert.ok(LEVELS.length >= 3 && LEVELS.length <= 5, "the campaign must ship with 3-5 levels");
assert.deepEqual(LEVELS.map((level) => level.order), [...LEVELS.keys()].map((index) => index + 1));
assert.ok(LEVELS.some((level) => level.objective.type === "count"));
assert.ok(LEVELS.some((level) => level.objective.type === "all"));
assert.equal(SHOP_OFFERS.filter((offer) => offer.purchaseLimit?.period === "daily").length, 2);
assert.equal(SHOP_OFFERS.find((offer) => offer.id === "recruitment-right").grants.recruitmentTickets, 1);

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
const trained = applySpecialistTraining(profile, { studentId: "planner", ability: "dynamicProgramming" });
assert.equal(trained.students.planner.abilities.dynamicProgramming, abilityBefore + SPECIALIST_TRAINING_INCREMENT);
assert.equal(trained.currencies.trainingCoins, 100);
assert.equal(trained.inventory[specialistTrainingBookId("dynamicProgramming")], 0);
assert.equal(profile.students.planner.abilities.dynamicProgramming, abilityBefore, "training must not mutate the supplied profile");
assert.throws(
  () => applySpecialistTraining({ ...profile, currencies: { trainingCoins: 0, recruitmentTickets: 0 } }, { studentId: "planner", ability: "dynamicProgramming" }),
  /training coins/,
);

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
const dismissed = dismissRecruitedStudent(dismissalProfile, { studentId: recruit.id });
assert.equal(dismissed.students[recruit.id], undefined);
assert.equal(dismissed.inventory[STUDENT_TRAINING_MATERIAL_ID], 1);
assert.throws(() => dismissRecruitedStudent(profile, { studentId: "planner" }), /Only recruited students/);
assert.throws(
  () => dismissRecruitedStudent({ ...dismissalProfile, formation: { A1: recruit.id, A2: "graphist", A3: "structurer" } }, { studentId: recruit.id }),
  /formation student/,
);

console.log("progression domain tests passed");
