import { expect, test } from "@playwright/test";

const profile = {
  schemaVersion: 3, version: 1, accountId: "arena-account", identitySeed: "arena", namePoolVersion: 1,
  students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
    id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
  }])),
  formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
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
    if (path === "/arena/opponents") return json([{ accountId: "opponent-account", rating: 1000, battlesWon: 4, battlesLost: 2 }]);
    if (path === "/arena/matches" && route.request().method() === "POST") { match = { id: "11111111-1111-4111-8111-111111111111", seed: "arena-seed", snapshots: { attacker: {}, defender: {} } }; return json(match, 201); }
    if (path.endsWith("/settle")) { profile.currencies.trainingCoins += 25; return json({ id: match.id, result: { winner: "attacker" }, rating: { attackerBefore: 1000, attackerAfter: 1025 }, reward: { trainingCoins: 25 }, replay: { attackerEventsHash: "hash-a", defenderEventsHash: "hash-d" } }); }
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
  await expect(page.getByText("比赛 11111111-1111-4111-8111-111111111111")).toBeVisible();
  await page.getByRole("button", { name: "开始回放并结算" }).click();
  await expect(page.getByText("挑战胜利")).toBeVisible();
  await expect(page.getByText("获得 25 训练币。")).toBeVisible();
  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByText("1025")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
