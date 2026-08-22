import { expect, test } from "@playwright/test";

const profile = {
  schemaVersion: 3, version: 1, accountId: "acct-1", identitySeed: "seed", namePoolVersion: 1,
  students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, index) => [id, {
    id, name: ["林澈", "周岚", "程野"][index], aptitude: "普通", abilities: { dynamicProgramming: 600, graphTheory: 600, dataStructures: 600, mathematics: 600, implementation: 600 }, maxEnergy: 5000, skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
  }])),
  formation: { A1: "planner", A2: "graphist", A3: "structurer" }, inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, unlockedLevelIds: ["chapter-1-1"],
};

async function mockApi(page) {
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: profile.accountId, username: "alice01" } }) : json({ message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: profile.accountId, username: "alice01" } }, 201); }
    if (path === "/profile") return json(profile);
    if (path === "/arena/defense") return json({ defense: null, snapshot: null, battlesToday: 0, dailyLimit: 40 });
    if (path === "/campaign/battles") {
      const team3 = Object.values(profile.students).map((s) => ({ ...s, skillGroupId: s.id, skillGroupLevels: { [s.id]: { normal: 1, burst: 1 } } }));
      const topics = [
        { id: "t1", name: "Topic1", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 3000 },
        { id: "t2", name: "Topic2", difficulties: { dynamicProgramming: 0, graphTheory: 500, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 3000 },
        { id: "t3", name: "Topic3", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 500, mathematics: 0, implementation: 0 }, maxProgress: 3000 },
      ];
      const sg = {
        planner: { id: "planner", name: "拆解思路", skills: { normal: { id: "planner-normal", name: "逐个击破", category: "problem", targetRule: "lowestRemaining", skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0, focusGain: 200 }, burst: { id: "planner-burst", name: "关键路径", category: "problem", targetRule: "highestDifficulty", skillMultiplier: 1.5, targetMultiplier: 1, flatBonus: 0, focusGain: 200 } } },
        graphist: { id: "graphist", name: "图论直觉", skills: { normal: { id: "graphist-normal", name: "匹配攻击", category: "problem", targetRule: "bestMatch", skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0, focusGain: 200 }, burst: { id: "graphist-burst", name: "割点突破", category: "problem", targetRule: "highestDifficulty", skillMultiplier: 1.35, targetMultiplier: 1, flatBonus: 120, focusGain: 200 } } },
        structurer: { id: "structurer", name: "结构维护", skills: { normal: { id: "structurer-normal", name: "稳态修复", category: "support", targetRule: "lowestEnergy", effectType: "energyRestore", amount: 650, focusGain: 200 }, burst: { id: "structurer-burst", name: "全队整备", category: "support", targetRule: "allStudents", effectType: "energyRestore", amount: 420, focusGain: 200 } } },
      };
      return json({ id: "battle-1", snapshot: { level: { name: "清晨训练场", topicIds: ["t1", "t2", "t3"], topics, maxRounds: 12, focusMax: 1000, objective: { type: "count", requiredTopics: 2 } }, seed: "A7C4-19", formation: { A1: "planner", A2: "graphist", A3: "structurer" }, team: team3, skillGroups: sg } }, 201);
    }
    if (path.endsWith("/settle")) return json({ result: { result: "win", completedCount: 3, round: 8, remainingEnergy: 9200 }, reward: { trainingCoins: 100 }, profile });
    return json({ message: path }, 404);
  });
}

async function login(page) {
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
}

test("a11y skip link keeps the current page", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator(".skip-link")).toBeAttached();
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(200);
  await expect(page).not.toHaveURL(/#campaign$/);
  await expect(page.getByText("上场队员")).toBeVisible();
});

test("a11y skip link during live battle stays on battle", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("button", { name: "开始挑战" }).click();
  await expect(page.getByRole("button", { name: "跳过" })).toBeVisible({ timeout: 15_000 });
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  await expect(page).not.toHaveURL(/#campaign$/);
  await expect(page.getByRole("button", { name: "跳过" })).toBeVisible();
});
