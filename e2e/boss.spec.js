import { expect, test } from "@playwright/test";
import { SKILL_GROUPS } from "../src/data.js";

const profile = {
  schemaVersion: 3, version: 1, accountId: "boss-account", identitySeed: "boss", namePoolVersion: 1,
  students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
    id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
  }])),
  formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
};

const bossSnapshot = {
  snapshotVersion: 3, engineVersion: 3, rulesetVersion: 3, profileVersion: 1, namePoolVersion: 1,
  seed: "boss:e2e-seed",
  timestamp: "2026-08-22T12:00:00.000Z",
  team: Object.values(profile.students),
  skillGroups: structuredClone(SKILL_GROUPS),
  formation: { ...profile.formation },
  level: {
    id: "boss-rush", name: "BOSS挑战", maxRounds: 30,
    objective: { type: "all", requiredTopics: 1 },
    topicIds: ["boss"], activeTopicSlots: ["B1", "B2", "B3"], studentSlots: ["A1", "A2", "A3"],
    focusMax: 1000, focusGain: 200, seed: "boss-e2e-level",
    topics: [{
      id: "boss", name: "BOSS", maxProgress: 1000000000,
      difficulties: { dynamicProgramming: 360, graphTheory: 360, dataStructures: 360, mathematics: 360, implementation: 360 },
      skill: { id: "boss-attack", name: "BOSS压制", category: "problem", effectType: "energyDamage", targetRule: "matching-position", damageMultiplier: 0.6 },
    }],
  },
};

test("boss rush challenge settles by damage", async ({ page }) => {
  let authenticated = false;
  let challenges = 0;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: profile.accountId, username: "boss01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: profile.accountId, username: "boss01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(profile);
    if (path === "/boss/quota") return json({ battlesToday: challenges, dailyLimit: 10 });
    if (path === "/boss/challenges" && route.request().method() === "POST") {
      challenges += 1;
      return json({ id: "44444444-4444-4444-8444-444444444444", seed: "boss:challenge", snapshot: bossSnapshot }, 201);
    }
    if (path.endsWith("/settle")) {
      const updated = structuredClone(profile);
      updated.currencies.trainingCoins += 315;
      return json({ id: "44444444-4444-4444-8444-444444444444", result: "lose", reason: "round-limit", round: 30, damage: 63000, remainingEnergy: 4100, reward: { trainingCoins: 315 }, profile: updated, replay: { eventsHash: "hash-b".padEnd(64, "0") } });
    }
    return json({ message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("boss01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "玩法" }).click();
  await page.getByRole("button", { name: "BOSS战" }).click();
  await expect(page.getByText("今日剩余挑战次数 10 / 10")).toBeVisible();
  const startButton = page.getByRole("button", { name: "开始挑战" });
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await expect(page.locator(".live-battle")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/累计伤害 \d+/)).toBeVisible({ timeout: 15_000 });
  const skipButton = page.getByRole("button", { name: "跳过" });
  await expect(skipButton).toBeEnabled({ timeout: 15_000 });
  await skipButton.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toContainText("63000");
  await expect(page.getByRole("dialog")).toContainText("获得 315 训练币。");
  await page.getByRole("button", { name: "知道了" }).click();
  await expect(page).toHaveURL(/#modes$/);
  await expect(page.getByRole("button", { name: "开始挑战" })).toBeVisible();
});
