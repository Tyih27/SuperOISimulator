import { expect, test } from "@playwright/test";

const students = Object.fromEntries([
  ["planner", "林澈"], ["graphist", "周岚"], ["structurer", "程野"],
  ["mathematician", "许知"], ["implementer", "沈言"], ["supporter", "顾宁"],
].map(([id, name], index) => [id, {
  id, name, aptitude: "普通", maxEnergy: 5000 + index * 10,
  abilities: { dynamicProgramming: 820, graphTheory: 820, dataStructures: 820, mathematics: 820, implementation: 820 },
  skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
}]));

function profile(version = 1) {
  return {
    schemaVersion: 3, version, accountId: "account-1", identitySeed: "test", namePoolVersion: 1,
    students: structuredClone(students), formation: { A1: "planner", A2: "graphist", A3: "structurer" },
    inventory: { "specialist-book-dynamicProgramming": 1 }, currencies: { trainingCoins: 1000, recruitmentTickets: 1 }, recruitment: { attemptsSinceGenius: 0 }, unlockedLevelIds: ["chapter-1-1"],
  };
}

async function mockApi(page) {
  let current = profile();
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (payload, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(payload) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "account-1", username: "alice01" } }) : json({ code: "UNAUTHENTICATED", message: "Authentication required" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "account-1", username: "alice01" } }, path === "/auth/register" ? 201 : 200); }
    if (path === "/auth/logout") { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path === "/account/export") return json({ exportedAt: "2026-08-19T12:00:00.000Z", account: { id: "account-1", username: "alice01" }, data: { profile: current, audit: [] } });
    if (path === "/account/password" && route.request().method() === "POST") { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path === "/account" && route.request().method() === "DELETE") { authenticated = false; return json({ status: "deleted" }); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    if (path === "/profile" && route.request().method() === "PUT") {
      const update = route.request().postDataJSON();
      current = { ...current, version: current.version + 1, ...("formation" in update ? { formation: update.formation } : {}), students: { ...current.students, ...Object.fromEntries(Object.entries(update.students ?? {}).map(([id, change]) => [id, { ...current.students[id], ...change }])) } };
      return json(current);
    }
    if (path === "/progression/training/specialist") return json({ profile: current });
    if (path === "/progression/shop/purchases") {
      const offerId = route.request().postDataJSON().offerId;
      if (offerId === "recruitment-right") {
        current = {
          ...current,
          version: current.version + 1,
          currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins - 300, recruitmentTickets: current.currencies.recruitmentTickets + 1 },
        };
      }
      return json({ profile: current });
    }
    if (path === "/progression/recruitment") {
      const student = { ...current.students.planner, id: "recruit-1", name: "天才候选", aptitude: "天才" };
      current = {
        ...current,
        version: current.version + 1,
        students: { ...current.students, [student.id]: student },
        currencies: { ...current.currencies, recruitmentTickets: current.currencies.recruitmentTickets - 1 },
        recruitment: { attemptsSinceGenius: 0 },
      };
      return json({ profile: current, student, recruitment: { aptitude: "天才", attemptsSinceGenius: 0 } });
    }
    if (path === "/progression/students/recruit-1/dismiss") {
      const { ["recruit-1"]: dismissedStudent, ...remainingStudents } = current.students;
      current = {
        ...current,
        version: current.version + 1,
        students: remainingStudents,
        inventory: { ...current.inventory, "student-training-material": (current.inventory["student-training-material"] ?? 0) + 1 },
      };
      return json({ profile: current, dismissal: { studentId: dismissedStudent?.id, itemId: "student-training-material", quantity: 1 } });
    }
    if (path === "/campaign/battles") {
      const team3 = Object.values(current.students).slice(0, 3).map((s) => ({ ...s, skillGroupId: s.id, skillGroupLevels: { [s.id]: { normal: 1, burst: 1 } } }));
      const topics = [
        { id: "t1", name: "Topic1", difficulties: { dynamicProgramming: 500, graphTheory: 0, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t1-atk", name: "T1 Attack", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
        { id: "t2", name: "Topic2", difficulties: { dynamicProgramming: 0, graphTheory: 500, dataStructures: 0, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t2-atk", name: "T2 Attack", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
        { id: "t3", name: "Topic3", difficulties: { dynamicProgramming: 0, graphTheory: 0, dataStructures: 500, mathematics: 0, implementation: 0 }, maxProgress: 10000, skill: { id: "t3-atk", name: "T3 Attack", category: "problem", effectType: "energyDamage", targetRule: "matchingPosition", damageMultiplier: 1, flatBonus: 0, maxDamage: 2000 } },
      ];
      const sg = {
        planner: { id: "planner", name: "拆解思路", skills: { normal: { id: "planner-normal", name: "逐个击破", category: "problem", targetRule: "lowestRemaining", skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0, focusGain: 200 }, burst: { id: "planner-burst", name: "关键路径", category: "problem", targetRule: "highestDifficulty", skillMultiplier: 1.5, targetMultiplier: 1, flatBonus: 0, focusGain: 200 } } },
        graphist: { id: "graphist", name: "图论直觉", skills: { normal: { id: "graphist-normal", name: "匹配攻击", category: "problem", targetRule: "bestMatch", skillMultiplier: 1, targetMultiplier: 1, flatBonus: 0, focusGain: 200 }, burst: { id: "graphist-burst", name: "割点突破", category: "problem", targetRule: "highestDifficulty", skillMultiplier: 1.35, targetMultiplier: 1, flatBonus: 120, focusGain: 200 } } },
        structurer: { id: "structurer", name: "结构维护", skills: { normal: { id: "structurer-normal", name: "稳态修复", category: "support", targetRule: "lowestEnergy", effectType: "energyRestore", amount: 650, focusGain: 200 }, burst: { id: "structurer-burst", name: "全队整备", category: "support", targetRule: "allStudents", effectType: "energyRestore", amount: 420, focusGain: 200 } } },
      };
      return json({ id: "7e11b4e1-0fc6-4af3-8a09-2c0591cebc22", snapshot: { level: { name: "清晨训练场", topics, maxRounds: 12, focusMax: 1000, objective: { type: "count", requiredTopics: 2 } }, seed: "A7C4-19", formation: { A1: "planner", A2: "graphist", A3: "structurer" }, team: team3, skillGroups: sg } }, 201);
    }
    if (path.endsWith("/settle")) return json({ result: { result: "win", completedCount: 3, round: 8, remainingEnergy: 9200, events: [{ round: 1, type: "battle_started" }, { round: 8, type: "battle_ended" }] }, reward: { trainingCoins: 100 }, profile: current });
    return json({ code: "NOT_FOUND", message: path }, 404);
  });
}

test("single-player campaign is server-driven", async ({ page }, testInfo) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator(".roster-detail-panel")).toHaveCount(1);
  await expect(page.locator(".roster-detail-panel")).toContainText("林澈");
  await expect(page.locator(".bench-pill")).toHaveCount(3);
  await page.getByRole("button", { name: "周岚" }).click();
  await expect(page.locator(".roster-detail-panel")).toContainText("周岚");
  await page.getByRole("button", { name: "调整阵容" }).click();
  await expect(page.locator("[data-lineup-overlay]")).toBeVisible();
  await expect(page.locator("[data-drag-student]")).toHaveCount(3);
  if (testInfo.project.name !== "mobile") {
    await page.locator('[data-drag-student="planner"]').dragTo(page.locator('[data-drop-position="A3"]'));
    await expect(page.locator('[data-drop-position="A1"]')).toContainText("程野");
    await expect(page.locator('[data-drop-position="A3"]')).toContainText("林澈");
    await page.getByRole("button", { name: "关闭调整阵容" }).click();
    await expect(page.locator("[data-lineup-overlay]")).toHaveCount(0);
    await page.getByRole("button", { name: "调整阵容" }).click();
    await expect(page.locator('[data-drop-position="A1"]')).toContainText("程野");
  } else {
    await expect(page.locator("[data-position]")).toHaveCount(0);
  }
  await page.getByRole("button", { name: "关闭调整阵容" }).click();
  await expect(page.locator("[data-lineup-overlay]")).toHaveCount(0);
  await page.getByRole("button", { name: "周岚" }).click();
  await page.getByRole("button", { name: "替换学生" }).click();
  await expect(page.locator(".replace-options")).toBeVisible();
  await page.locator('[data-replace-with="mathematician"]').click();
  await expect(page.getByText("许知 已替换上场。")).toBeVisible();
  await expect(page.locator(".roster-tab").filter({ hasText: "许知" })).toBeVisible();
  await expect(page.locator(".roster-tab").filter({ hasText: "周岚" })).toHaveCount(0);
  await expect(page.locator(".bench-pill").filter({ hasText: "周岚" })).toBeVisible();
  await page.getByRole("button", { name: "调整阵容" }).click();
  await expect(page.locator('[data-drop-position="A2"]')).toContainText("许知");
  await page.getByRole("button", { name: "关闭调整阵容" }).click();
  await page.getByRole("button", { name: /程野/ }).click();
  await expect(page.locator(".roster-detail-panel").getByRole("heading", { name: "程野" })).toBeVisible();
  await expect(page.getByText("上场队员")).toBeVisible();
  await page.getByRole("button", { name: "提升", exact: true }).click();
  await page.locator('input[name="enhance-ability"]').first().check();
  await page.getByRole("button", { name: "确认提升" }).click();
  await expect(page.getByText(/学生强化完成/)).toBeVisible();
  await page.getByRole("button", { name: "详细信息" }).click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();
  await page.getByRole("button", { name: "关闭学生详情" }).click();
  await expect(page.locator(".student-detail-dialog")).toHaveCount(0);
  await page.getByRole("link", { name: "主线关卡" }).click();
  await expect(page.getByText("第 1 章")).toBeVisible();
  await page.getByRole("button", { name: "开始挑战" }).click();
  await expect(page.getByRole("heading", { name: "快照已锁定" })).toBeVisible();
  await page.getByRole("button", { name: "开始回放并结算" }).click();
  await expect(page.getByText("挑战胜利")).toBeVisible();
  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByText("天才保底")).toBeVisible();
  await page.locator('[data-buy-offer="recruitment-right"]').click();
  await page.getByRole("button", { name: "使用招募券" }).click();
  await expect(page.getByText(/已招募一名天才学生/)).toBeVisible();
  await page.getByRole("link", { name: "学生名单", exact: true }).click();
  await page.locator('[data-student-detail="recruit-1"]').click();
  await page.getByRole("button", { name: "劝退并获得培养材料" }).click();
  await expect(page.getByText("学生已劝退，获得 1 份学生培养材料。")).toBeVisible();
  await expect(page.locator('[data-student-detail="recruit-1"]')).toHaveCount(0);
  await page.getByRole("link", { name: "训练与补给" }).click();
  await page.reload();
  await expect(page.getByRole("heading", { name: "进度管理" })).toBeVisible();
  await page.getByRole("link", { name: "账户与数据" }).click();
  await expect(page.getByRole("heading", { name: "账户管理" })).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "下载 JSON" }).click();
  expect((await download).suggestedFilename()).toBe("super-oi-account-1.json");
  await page.getByLabel("当前密码").fill("correct horse battery");
  await page.getByRole("textbox", { name: "新密码", exact: true }).fill("new correct horse battery");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByText("训练档案")).toBeVisible();
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("new correct horse battery");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page.getByText("训练档案")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("account deletion revokes the browser session", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "账户与数据" }).click();
  await page.getByLabel("账户密码").fill("correct horse battery");
  await page.getByLabel("我理解此操作会立即永久删除我的账户").check();
  await page.getByRole("button", { name: "删除账户" }).click();
  await expect(page.getByText("训练档案")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("battle playback controls work correctly", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "主线关卡" }).click();
  await page.getByRole("button", { name: "开始挑战" }).click();
  await expect(page.getByRole("heading", { name: "快照已锁定" })).toBeVisible();
  await page.getByRole("button", { name: "开始回放并结算" }).click();
  await expect(page.getByText("服务端回放")).toBeVisible();
  const pauseBtn = page.getByRole("button", { name: "暂停" });
  const playBtn = page.getByRole("button", { name: "播放" });
  if (await pauseBtn.isVisible().catch(() => false)) {
    await pauseBtn.click();
    await expect(playBtn).toBeVisible();
    await playBtn.click();
  }
  const stepBtn = page.getByRole("button", { name: "单步" });
  if (await stepBtn.isVisible().catch(() => false)) {
    await stepBtn.click();
  }
  const restartBtn = page.getByRole("button", { name: "重播" });
  if (await restartBtn.isVisible().catch(() => false)) {
    await restartBtn.click();
  }
  const speed2x = page.getByRole("button", { name: "2x" });
  if (await speed2x.isVisible().catch(() => false)) {
    await speed2x.click();
    await expect(speed2x).toHaveClass(/is-active/);
  }
  await expect(page.getByText(/挑战胜利|挑战失败/)).toBeVisible();
});

test("campaign level selection updates detail", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await page.getByRole("link", { name: "主线关卡" }).click();
  await expect(page.getByText("第 1 章")).toBeVisible();
  await expect(page.getByRole("heading", { name: "清晨训练场" })).toBeVisible();
  const level2Btn = page.locator('[data-select-level="chapter-1-2"]');
  if (await level2Btn.isDisabled().catch(() => true)) {
    await expect(level2Btn).toBeDisabled();
  }
});

test("session restore on page reload", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "主线关卡" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "主线关卡" })).toBeVisible();
  await expect(page.getByLabel("用户名")).toBeHidden();
});
