import { randomUUID } from "node:crypto";
import { LEVELS, SHOP_OFFERS, STUDENTS } from "../../src/data.js";
import {
  applySpecialistTraining,
  createRecruitedStudent,
  dismissStudent,
  SPECIALIST_TRAINING_COST,
  STUDENT_DISMISSAL_MATERIAL_REWARD,
  STUDENT_TRAINING_MATERIAL_ID,
  specialistTrainingBookId,
  rollRecruitmentAptitude,
} from "../../src/domain/progression.js";
import { LedgerRepository } from "../repositories/ledger-repository.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { ProfileService, profileFromRow } from "./profile-service.js";
import { AuditRepository } from "../repositories/audit-repository.js";

const levelById = new Map(LEVELS.map((level) => [level.id, level]));
const offerById = new Map(SHOP_OFFERS.map((offer) => [offer.id, offer]));

export class ProgressionError extends Error {
  constructor(code, statusCode, message) {
    super(message);
    this.name = "ProgressionError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function invalid(message) {
  return new ProgressionError("INVALID_PROGRESSION_REQUEST", 400, message);
}

function conflict(code, message) {
  return new ProgressionError(code, 409, message);
}

function requireString(value, message) {
  if (typeof value !== "string" || value.trim() === "") throw invalid(message);
  return value;
}

function dailyPeriod(now) {
  const timeZone = process.env.RESET_TIME_ZONE || "Asia/Shanghai";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const values = Object.fromEntries(parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function addInventory(profile, grants) {
  for (const [itemId, quantity] of Object.entries(grants ?? {})) {
    profile.inventory[itemId] = (profile.inventory[itemId] ?? 0) + quantity;
  }
}

function addCurrencies(profile, reward) {
  for (const currency of ["trainingCoins", "recruitmentTickets"]) {
    const amount = reward[currency] ?? 0;
    if (amount > 0) profile.currencies[currency] += amount;
  }
}

const CURRENCY_KEYS = new Set(["trainingCoins", "recruitmentTickets"]);
const DAILY_CHECK_IN_REWARD = Object.freeze({ trainingCoins: 1_000 });

function addShopGrants(profile, grants) {
  for (const [itemId, quantity] of Object.entries(grants ?? {})) {
    if (CURRENCY_KEYS.has(itemId)) profile.currencies[itemId] += quantity;
    else profile.inventory[itemId] = (profile.inventory[itemId] ?? 0) + quantity;
  }
}

export class ProgressionService {
  constructor(pool, { now = () => new Date(), idFactory = randomUUID, starterStudentIds = null } = {}) {
    this.pool = pool;
    this.repository = new ProfileRepository(pool);
    this.ledger = new LedgerRepository();
    this.audit = new AuditRepository();
    this.profileDefaults = new ProfileService(pool, { starterStudentIds });
    this.now = now;
    this.idFactory = idFactory;
  }

  async withProfile(accountId, mutate) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const row = await this.repository.findOrCreateForUpdate(client, {
        accountId,
        profile: this.profileDefaults.defaultProfile(accountId),
      });
      const profile = profileFromRow(row, accountId);
      const outcome = await mutate({ client, profile, currentVersion: row.version });
      profile.version = row.version + 1;
      const saved = await this.repository.update(client, { accountId, version: profile.version, profile });
      const { auditAction = "progression_update", auditPayload = {}, ...publicOutcome } = outcome;
      await this.audit.append(client, { accountId, actionType: auditAction, payload: auditPayload });
      await client.query("COMMIT");
      return { ...publicOutcome, profile: structuredClone(saved.payload) };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async settleCampaignBattle({ accountId, settlementId, levelId, result } = {}) {
    requireString(accountId, "Account is required");
    requireString(settlementId, "Settlement id is required");
    const level = levelById.get(levelId);
    if (!level) throw invalid("Unknown campaign level");
    if (result !== "win") throw invalid("Only a completed campaign victory can be settled");

    return this.withProfile(accountId, async ({ client, profile }) => {
      if (!profile.unlockedLevelIds.includes(levelId)) throw invalid("Campaign level is locked");
      const recorded = await this.ledger.recordCampaignSettlement(client, { accountId, settlementId, levelId });
      if (!recorded) throw conflict("BATTLE_ALREADY_SETTLED", "Campaign battle is already settled");

      const reward = structuredClone(level.reward);
      addCurrencies(profile, reward);
      addInventory(profile, reward.inventory);
      if (reward.unlockLevelId && !profile.unlockedLevelIds.includes(reward.unlockLevelId)) {
        profile.unlockedLevelIds.push(reward.unlockLevelId);
      }
      for (const currency of ["trainingCoins", "recruitmentTickets"]) {
        const delta = reward[currency] ?? 0;
        if (delta > 0) await this.ledger.recordCurrency(client, { accountId, currency, delta, sourceType: "campaign", sourceId: settlementId });
      }
      for (const [itemId, quantity] of Object.entries(reward.inventory ?? {})) {
        await this.ledger.recordInventoryGrant(client, { accountId, itemId, quantity, sourceType: "campaign", sourceId: settlementId });
      }
      return { reward, auditAction: "campaign_reward", auditPayload: { settlementId, levelId } };
    });
  }

  async trainSpecialist(accountId, request) {
    requireString(accountId, "Account is required");
    const studentId = requireString(request?.studentId, "Student id is required");
    const ability = requireString(request?.ability, "Ability is required");
    return this.withProfile(accountId, async ({ client, profile }) => {
      let next;
      try {
        next = applySpecialistTraining(profile, { studentId, ability });
      } catch (error) {
        throw invalid(error.message);
      }
      const previousValue = profile.students[studentId].abilities[ability];
      const currentValue = next.students[studentId].abilities[ability];
      const bookId = specialistTrainingBookId(ability);
      const itemId = (next.inventory[bookId] ?? 0) < (profile.inventory[bookId] ?? 0)
        ? bookId
        : STUDENT_TRAINING_MATERIAL_ID;
      Object.assign(profile, next);
      await this.ledger.recordCurrency(client, {
        accountId,
        currency: "trainingCoins",
        delta: -SPECIALIST_TRAINING_COST,
        sourceType: "specialist-training",
        sourceId: `${studentId}:${ability}`,
      });
      return {
        training: { studentId, ability, itemId, previousValue, currentValue, increment: currentValue - previousValue },
        auditAction: "specialist_training",
        auditPayload: { studentId, ability },
      };
    });
  }

  async purchaseShopOffer(accountId, { offerId } = {}) {
    requireString(accountId, "Account is required");
    const normalizedOfferId = typeof offerId === "string" ? offerId.trim() : offerId;
    const offer = offerById.get(normalizedOfferId);
    if (!offer) throw invalid("Unknown shop offer");
    return this.withProfile(accountId, async ({ client, profile }) => {
      const price = offer.price.trainingCoins ?? 0;
      if (profile.currencies.trainingCoins < price) throw invalid("Not enough training coins");
      profile.currencies.trainingCoins -= price;
      addShopGrants(profile, offer.grants);
      if (price > 0) await this.ledger.recordCurrency(client, { accountId, currency: "trainingCoins", delta: -price, sourceType: "shop", sourceId: normalizedOfferId });
      for (const [itemId, quantity] of Object.entries(offer.grants)) {
        if (CURRENCY_KEYS.has(itemId)) {
          await this.ledger.recordCurrency(client, { accountId, currency: itemId, delta: quantity, sourceType: "shop", sourceId: normalizedOfferId });
        } else {
          await this.ledger.recordInventoryGrant(client, { accountId, itemId, quantity, sourceType: "shop", sourceId: normalizedOfferId });
        }
      }
      return { offer: structuredClone(offer), auditAction: "shop_purchase", auditPayload: { offerId: normalizedOfferId } };
    });
  }

  async claimDailyCheckIn(accountId) {
    requireString(accountId, "Account is required");
    return this.withProfile(accountId, async ({ client, profile }) => {
      const claimPeriod = dailyPeriod(this.now());
      const claimed = await this.ledger.claimDailyCheckIn(client, { accountId, claimPeriod });
      if (!claimed) throw conflict("DAILY_CHECK_IN_ALREADY_CLAIMED", "今日签到奖励已领取");

      addCurrencies(profile, DAILY_CHECK_IN_REWARD);
      await this.ledger.recordCurrency(client, {
        accountId,
        currency: "trainingCoins",
        delta: DAILY_CHECK_IN_REWARD.trainingCoins,
        sourceType: "daily-check-in",
        sourceId: claimPeriod,
      });
      return {
        reward: structuredClone(DAILY_CHECK_IN_REWARD),
        claimPeriod,
        auditAction: "daily_check_in",
        auditPayload: { claimPeriod },
      };
    });
  }

  async dismissStudent(accountId, { studentId } = {}) {
    requireString(accountId, "Account is required");
    requireString(studentId, "Student id is required");
    return this.withProfile(accountId, async ({ client, profile }) => {
      let next;
      try {
        next = dismissStudent(profile, { studentId: studentId.trim() });
      } catch (error) {
        throw invalid(error.message);
      }
      Object.assign(profile, next);
      await this.ledger.recordInventoryGrant(client, {
        accountId,
        itemId: STUDENT_TRAINING_MATERIAL_ID,
        quantity: STUDENT_DISMISSAL_MATERIAL_REWARD,
        sourceType: "student-dismissal",
        sourceId: studentId.trim(),
      });
      return {
        dismissal: {
          studentId: studentId.trim(),
          itemId: STUDENT_TRAINING_MATERIAL_ID,
          quantity: STUDENT_DISMISSAL_MATERIAL_REWARD,
        },
        auditAction: "student_dismissal",
        auditPayload: { studentId: studentId.trim(), itemId: STUDENT_TRAINING_MATERIAL_ID },
      };
    });
  }

  async recruitStudent(accountId) {
    requireString(accountId, "Account is required");
    return this.withProfile(accountId, async ({ client, profile }) => {
      if (profile.currencies.recruitmentTickets < 1) throw invalid("Not enough recruitment tickets");
      const studentId = `recruit-${this.idFactory()}`;
      const templateIndex = profile.recruitment.templateIndex ?? 0;
      const template = STUDENTS[templateIndex % STUDENTS.length];
      const recruitment = rollRecruitmentAptitude({
        seed: `${profile.identitySeed}:${studentId}`,
        attemptsSinceGenius: profile.recruitment.attemptsSinceGenius,
      });
      const student = createRecruitedStudent({
        studentId,
        seed: `${profile.identitySeed}:${studentId}`,
        namePoolVersion: profile.namePoolVersion,
        templateId: template.id,
        aptitude: recruitment.aptitude,
      });
      profile.students[studentId] = student;
      profile.currencies.recruitmentTickets -= 1;
      profile.recruitment.attemptsSinceGenius = recruitment.attemptsSinceGenius;
      profile.recruitment.templateIndex = templateIndex + 1;
      await this.ledger.recordCurrency(client, { accountId, currency: "recruitmentTickets", delta: -1, sourceType: "recruitment", sourceId: studentId });
      return {
        student,
        recruitment: { aptitude: recruitment.aptitude, attemptsSinceGenius: recruitment.attemptsSinceGenius },
        auditAction: "student_recruitment",
        auditPayload: { studentId, aptitude: recruitment.aptitude },
      };
    });
  }
}
