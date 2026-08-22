import { expect, test } from "@playwright/test";
import { SKILL_GROUPS } from "../src/data.js";

const profile = {
  schemaVersion: 3, version: 1, accountId: "arena-account", identitySeed: "arena", namePoolVersion: 1,
  students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
    id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
  }])),
  formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
};

const attackerSnapshot = {
  snapshotVersion: 3, engineVersion: 3, rulesetVersion: 3, profileVersion: 1, namePoolVersion: 1,
  seed: "arena-e2e-seed",
  timestamp: "2026-08-21T12:00:00.000Z",
  team: Object.values(profile.students),
  skillGroups: structuredClone(SKILL_GROUPS),
  formation: { ...profile.formation },
  level: {
    id: "chapter-1-1", name: "清晨训练场", maxRounds: 6,
    objective: { type: "all" },
    topicIds: ["t1", "t2", "t3"], activeTopicSlots: ["B1", "B2", "B3"], studentSlots: ["A1", "A2", "A3"],
    focusMax: 1000, focusGain: 200, seed: "level-e2e-seed",
    topics: ["t1", "t2", "t3"].map((id, index) => ({
      id, name: ["模拟", "排序", "搜索"][index],
      difficulties: { dynamicProgramming: 120, graphTheory: 120, dataStructures: 120, mathematics: 120, implementation: 120 },
      maxProgress: 1000,
    })),
  },
};

test("arena defense, replay, and historical view are server-driven", async ({ page }) => {
  let authenticated = false;
  let defense = null;
  let match = null;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: profile.accountId, username: "arena01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: profile.accountId, username: "arena01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(profile);
    if (path === "/arena/defense" && route.request().method() === "PUT") { defense = { accountId: profile.accountId, rating: 1000, battlesWon: 0, battlesLost: 0 }; return json({ defense, snapshot: { team: Object.values(profile.students) } }); }
    if (path === "/arena/defense") return json({ defense, snapshot: { team: Object.values(profile.students) }, battlesToday: 0, dailyLimit: 40 });
    if (path === "/arena/opponents") return json([{ accountId: "opponent-account", rating: 1000, battlesWon: 4, battlesLost: 2, power: 2460 }]);
    if (path === "/arena/matches" && route.request().method() === "POST") { match = { id: "11111111-1111-4111-8111-111111111111", seed: "arena-seed", snapshots: { attacker: attackerSnapshot, defender: {} } }; return json(match, 201); }
    if (path.endsWith("/settle")) { profile.currencies.trainingCoins += 25; return json({ id: match.id, result: { winner: "attacker" }, rating: { attackerBefore: 1000, attackerAfter: 1025 }, reward: { trainingCoins: 25 }, replay: { attackerEventsHash: "hash-a", defenderEventsHash: "hash-d" }, events: { attacker: [], defender: [] } }); }
    return json({ message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("arena01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "异步竞技场" }).click();
  await page.getByRole("button", { name: "保存当前编队" }).click();
  await page.getByRole("button", { name: "刷新列表" }).click();
  await expect(page.getByText("战力 2460")).toBeVisible();
  await page.getByRole("button", { name: "挑战" }).click();
  await expect(page.getByText("等待该方战斗快照")).toBeVisible();
  await expect(page.getByText("今日剩余挑战次数 39 / 40")).toBeVisible();
  await expect(page.locator(".live-battle")).toBeVisible();
  await expect(page.getByText(/已通过 \d+ \/ 目标 3/)).toBeVisible();
  await expect(page.getByRole("button", { name: "开始结算并查看结果" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toContainText("挑战胜利");
  await expect(page.getByRole("dialog")).toContainText("获得 25 训练币。");
  await page.getByRole("button", { name: "知道了" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(/#arena$/);
  await expect(page.getByText("可挑战对手")).toBeVisible();
  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByText("1025")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("arena loss shows no reward", async ({ page }) => {
  let authenticated = false;
  let defense = null;
  let match = null;
  const arenaProfile = {
    schemaVersion: 3, version: 1, accountId: "arena-account", identitySeed: "arena", namePoolVersion: 1,
    students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
      id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
    }])),
    formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: arenaProfile.accountId, username: "arena01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: arenaProfile.accountId, username: "arena01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(arenaProfile);
    if (path === "/arena/defense" && route.request().method() === "PUT") { defense = { accountId: arenaProfile.accountId, rating: 1000, battlesWon: 0, battlesLost: 0 }; return json({ defense, snapshot: { team: Object.values(arenaProfile.students) } }); }
    if (path === "/arena/opponents") return json([{ accountId: "opponent-account", rating: 1000, battlesWon: 4, battlesLost: 2 }]);
    if (path === "/arena/matches" && route.request().method() === "POST") { match = { id: "22222222-2222-4222-8222-222222222222", seed: "arena-seed", snapshots: { attacker: {}, defender: {} } }; return json(match, 201); }
    if (path.endsWith("/settle")) return json({ id: match.id, result: { winner: "defender" }, rating: { attackerBefore: 1000, attackerAfter: 975 }, reward: {}, replay: { attackerEventsHash: "hash-a", defenderEventsHash: "hash-d" } });
    return json({ message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("arena01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "异步竞技场" }).click();
  await page.getByRole("button", { name: "保存当前编队" }).click();
  await page.getByRole("button", { name: "刷新列表" }).click();
  await page.getByRole("button", { name: "挑战" }).click();
  await expect(page.getByRole("button", { name: "开始结算并查看结果" })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText("挑战失败");
  await expect(page.getByRole("dialog")).not.toContainText("获得 25 训练币");
});

test("arena match history loads", async ({ page }) => {
  let authenticated = false;
  let defense = null;
  const arenaProfile = {
    schemaVersion: 3, version: 1, accountId: "arena-account", identitySeed: "arena", namePoolVersion: 1,
    students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
      id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
    }])),
    formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: arenaProfile.accountId, username: "arena01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: arenaProfile.accountId, username: "arena01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(arenaProfile);
    if (path === "/arena/defense" && route.request().method() === "PUT") { defense = { accountId: arenaProfile.accountId, rating: 1000, battlesWon: 0, battlesLost: 0 }; return json({ defense }); }
    if (path === "/arena/opponents") return json([]);
    if (path === "/arena/matches") return json([
      { id: "match-1", status: "settled", result: { winner: "attacker" }, createdAt: "2026-08-20T10:00:00Z", settledAt: "2026-08-20T10:01:00Z" },
      { id: "match-2", status: "started", createdAt: "2026-08-21T10:00:00Z" },
    ]);
    return json({ message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("arena01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "异步竞技场" }).click();
  await page.getByRole("button", { name: "保存当前编队" }).click();
  await page.getByRole("button", { name: "刷新" }).last().click();
  await expect(page.getByText("match-1")).toBeVisible();
  await expect(page.getByText("match-2")).toBeVisible();
});

test("defense required before challenge", async ({ page }) => {
  let authenticated = false;
  const arenaProfile = {
    schemaVersion: 3, version: 1, accountId: "arena-account", identitySeed: "arena", namePoolVersion: 1,
    students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
      id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
    }])),
    formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
  };
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: arenaProfile.accountId, username: "arena01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: arenaProfile.accountId, username: "arena01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(arenaProfile);
    if (path === "/arena/opponents") return json([]);
    return json({ message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("arena01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "异步竞技场" }).click();
  await expect(page.getByText("请先保存防守编队")).toBeVisible();
});
