import { randomUUID } from "node:crypto";
import { LEVELS, SHOP_OFFERS, STUDENTS } from "../../src/data.js";
import {
  applySpecialistTraining,
  createRecruitedStudent,
  SPECIALIST_TRAINING_COST,
  specialistTrainingBookId,
} from "../../src/domain/progression.js";
import { LedgerRepository } from "../repositories/ledger-repository.js";
import { ProfileRepository } from "../repositories/profile-repository.js";
import { ProfileService } from "./profile-service.js";

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
  return now.toISOString().slice(0, 10);
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

export class ProgressionService {
  constructor(pool, { now = () => new Date(), idFactory = randomUUID } = {}) {
    this.pool = pool;
    this.repository = new ProfileRepository(pool);
    this.ledger = new LedgerRepository();
    this.profileDefaults = new ProfileService(pool);
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
      const profile = structuredClone(row.payload);
      const outcome = await mutate({ client, profile, currentVersion: row.version });
      profile.version = row.version + 1;
      const saved = await this.repository.update(client, { accountId, version: profile.version, profile });
      await client.query("COMMIT");
      return { ...outcome, profile: structuredClone(saved.payload) };
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
      return { reward };
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
      Object.assign(profile, next);
      await this.ledger.recordCurrency(client, {
        accountId,
        currency: "trainingCoins",
        delta: -SPECIALIST_TRAINING_COST,
        sourceType: "specialist-training",
        sourceId: `${studentId}:${ability}`,
      });
      return { training: { studentId, ability, itemId: specialistTrainingBookId(ability) } };
    });
  }

  async purchaseShopOffer(accountId, { offerId } = {}) {
    requireString(accountId, "Account is required");
    const offer = offerById.get(offerId);
    if (!offer) throw invalid("Unknown shop offer");
    return this.withProfile(accountId, async ({ client, profile }) => {
      const price = offer.price.trainingCoins ?? 0;
      if (profile.currencies.trainingCoins < price) throw invalid("Not enough training coins");
      if (offer.purchaseLimit) {
        const resetPeriod = offer.purchaseLimit.period === "daily" ? dailyPeriod(this.now()) : "permanent";
        const claimed = await this.ledger.claimShopPurchase(client, { accountId, offerId, resetPeriod });
        if (!claimed) throw conflict("SHOP_PURCHASE_LIMIT_REACHED", "Shop purchase limit has been reached");
      }
      profile.currencies.trainingCoins -= price;
      addInventory(profile, offer.grants);
      if (price > 0) await this.ledger.recordCurrency(client, { accountId, currency: "trainingCoins", delta: -price, sourceType: "shop", sourceId: offerId });
      for (const [itemId, quantity] of Object.entries(offer.grants)) {
        await this.ledger.recordInventoryGrant(client, { accountId, itemId, quantity, sourceType: "shop", sourceId: offerId });
      }
      return { offer: structuredClone(offer) };
    });
  }

  async recruitStudent(accountId) {
    requireString(accountId, "Account is required");
    return this.withProfile(accountId, async ({ client, profile }) => {
      if (profile.currencies.recruitmentTickets < 1) throw invalid("Not enough recruitment tickets");
      const studentId = `recruit-${this.idFactory()}`;
      const template = STUDENTS[Object.keys(profile.students).length % STUDENTS.length];
      const student = createRecruitedStudent({
        studentId,
        seed: `${profile.identitySeed}:${studentId}`,
        namePoolVersion: profile.namePoolVersion,
        templateId: template.id,
        aptitude: "普通",
      });
      profile.students[studentId] = student;
      profile.currencies.recruitmentTickets -= 1;
      await this.ledger.recordCurrency(client, { accountId, currency: "recruitmentTickets", delta: -1, sourceType: "recruitment", sourceId: studentId });
      return { student };
    });
  }
}
