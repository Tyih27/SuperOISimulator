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
    schemaVersion: 3, version, accountId: "roster-account", identitySeed: "roster-test", namePoolVersion: 1,
    students: structuredClone(students), formation: { A1: "planner", A2: "graphist", A3: "structurer" },
    inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 },
    recruitment: { attemptsSinceGenius: 0 }, unlockedLevelIds: ["chapter-1-1"],
  };
}

async function mockApi(page, options = {}) {
  let current = profile();
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/auth/logout") { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path === "/profile" && method === "GET") return json(current);
    if (path === "/profile" && method === "PUT") {
      const update = route.request().postDataJSON();
      current = { ...current, version: current.version + 1, ...("formation" in update ? { formation: update.formation } : {}), students: { ...current.students, ...Object.fromEntries(Object.entries(update.students ?? {}).map(([id, change]) => [id, { ...current.students[id], ...change }])) } };
      return json(current);
    }
    if (path === "/campaign/battles") return json({ id: "battle-1", snapshot: { level: { name: "清晨训练场" }, seed: "seed", team: Object.values(current.students).slice(0, 3) } }, 201);
    if (path.endsWith("/settle")) return json({ result: { result: "win", completedCount: 3, round: 8, remainingEnergy: 9200, events: [] }, reward: { trainingCoins: 100 }, profile: current });
    return json({ code: "NOT_FOUND", message: path }, 404);
  });
}

async function login(page) {
  await page.goto("/");
  await page.getByLabel("用户名").fill("roster01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "学生名单" })).toBeVisible();
}

// ── Student detail dialog ────────────────────────────────────────────────────

test("student detail dialog opens and closes", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator(".roster-tab")).toHaveCount(3);

  await page.locator('[data-student-detail="planner"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByRole("heading", { name: "林澈" })).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("普通")).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("动态规划", { exact: true })).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("常规技能", { exact: true })).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("爆发技能", { exact: true })).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("总体水平")).toBeVisible();
  await expect(page.locator(".student-detail-dialog").getByText("最大精力")).toBeVisible();

  await page.locator('[data-action="close-student-detail"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeHidden();
});

test("student detail closes on overlay click", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-select-roster-student="graphist"]').click();
  await page.locator('[data-student-detail="graphist"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();

  await page.locator("[data-student-detail-overlay]").click({ position: { x: 10, y: 10 } });
  await expect(page.locator(".student-detail-dialog")).toBeHidden();
});

test("student detail closes on Escape", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-select-roster-student="structurer"]').click();
  await page.locator('[data-student-detail="structurer"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".student-detail-dialog")).toBeHidden();
});

// ── Rename student ───────────────────────────────────────────────────────────

test("rename student flow", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-student-detail="planner"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();

  await page.getByRole("button", { name: "修改名字" }).click();
  await expect(page.locator("[data-name-input]")).toBeVisible();

  const input = page.locator("[data-name-input]");
  await input.clear();
  await input.fill("新名字");
  await page.locator('[data-save-name="planner"]').click();
  await expect(page.getByText("学生名称已保存")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".student-detail-dialog")).toBeHidden();
});

test("rename cancel and Enter submit", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-student-detail="planner"]').click();
  await page.getByRole("button", { name: "修改名字" }).click();
  await expect(page.locator("[data-name-input]")).toBeVisible();

  await page.getByRole("button", { name: "取消" }).click();
  await expect(page.getByText("已取消名称修改")).toBeVisible();
  await expect(page.locator("[data-name-input]")).toBeHidden();

  await page.keyboard.press("Escape");
  await expect(page.locator(".student-detail-dialog")).toBeHidden();

  await page.locator('[data-student-detail="planner"]').click();
  await page.getByRole("button", { name: "修改名字" }).click();
  const input = page.locator("[data-name-input]");
  await input.clear();
  await input.fill("键盘提交");
  await input.press("Enter");
  await expect(page.getByText("学生名称已保存")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(".student-detail-dialog")).toBeHidden();
});

// ── Dismiss recruited student ────────────────────────────────────────────────

test("dismissible recruited student shows dismiss button", async ({ page }) => {
  let current = profile();
  current.students["recruit-1"] = { ...current.students.planner, id: "recruit-1", name: "招募学生", aptitude: "天才" };
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && method === "GET") return json(current);
    if (path === "/profile" && method === "PUT") {
      const update = route.request().postDataJSON();
      current = { ...current, version: current.version + 1, ...("formation" in update ? { formation: update.formation } : {}), students: { ...current.students, ...Object.fromEntries(Object.entries(update.students ?? {}).map(([id, ch]) => [id, { ...current.students[id], ...ch }])) } };
      return json(current);
    }
    if (path.includes("/dismiss")) {
      const { "recruit-1": _, ...rest } = current.students;
      current = { ...current, version: current.version + 1, students: rest, inventory: { ...current.inventory, "student-training-material": 1 } };
      return json({ profile: current, dismissal: { studentId: "recruit-1", itemId: "student-training-material", quantity: 1 } });
    }
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("roster01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "学生名单" })).toBeVisible();

  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-student-detail="recruit-1"]').click();
  await expect(page.locator(".student-detail-dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "劝退并获得培养材料" })).toBeVisible();

  await page.getByRole("button", { name: "劝退并获得培养材料" }).click();
  await expect(page.getByText("学生已劝退，获得 1 份学生培养材料。")).toBeVisible();
});

test("formation student does not show dismiss button", async ({ page }) => {
  let current = profile();
  current.students["recruit-1"] = { ...current.students.planner, id: "recruit-1", name: "招募学生", aptitude: "天才" };
  current.formation = { A1: "recruit-1", A2: "graphist", A3: "structurer" };
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("roster01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "学生名单" })).toBeVisible();

  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-select-roster-student="recruit-1"]').click();
  await expect(page.getByRole("heading", { name: "招募学生" })).toBeVisible();
  await expect(page.getByRole("button", { name: "劝退并获得培养材料" })).toBeHidden();
});

test("bench starter student is dismissible", async ({ page }) => {
  let current = profile();
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    if (path.includes("/dismiss")) {
      const { mathematician: _, ...rest } = current.students;
      current = { ...current, version: current.version + 1, students: rest, inventory: { ...current.inventory, "student-training-material": 1 } };
      return json({ profile: current, dismissal: { studentId: "mathematician", itemId: "student-training-material", quantity: 1 } });
    }
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await page.goto("/");
  await page.getByLabel("用户名").fill("roster01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "学生名单" })).toBeVisible();

  await page.getByRole("link", { name: "学生名单" }).click();
  await page.locator('[data-student-detail="mathematician"]').click();
  await expect(page.getByRole("heading", { name: "许知" })).toBeVisible();
  await expect(page.getByRole("button", { name: "劝退并获得培养材料" })).toBeVisible();

  await page.getByRole("button", { name: "劝退并获得培养材料" }).click();
  await expect(page.getByText("学生已劝退，获得 1 份学生培养材料。")).toBeVisible();
});

test("bench sorts by power and batch dismissal confirms rare students", async ({ page }) => {
  let current = profile();
  current.students.supporter.abilities = { ...current.students.supporter.abilities, dynamicProgramming: 1200 };
  current.students.mathematician.abilities = { ...current.students.mathematician.abilities, dynamicProgramming: 1000 };
  current.students.implementer = { ...current.students.implementer, aptitude: "天才" };
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    if (path.includes("dismiss-batch")) {
      const body = route.request().postDataJSON();
      const ids = body.studentIds;
      for (const id of ids) delete current.students[id];
      current = { ...current, version: current.version + 1, inventory: { ...current.inventory, "student-training-material": (current.inventory["student-training-material"] ?? 0) + ids.length } };
      return json({ profile: current, dismissal: { studentIds: ids, itemId: "student-training-material", quantity: ids.length } });
    }
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator(".bench-pill strong")).toHaveText(["顾宁", "许知", "沈言"]);

  await page.getByRole("button", { name: "批量劝退" }).click();
  await expect(page.locator(".dismiss-tile")).toHaveCount(3);
  await expect(page.locator(".dismiss-stat-chip")).toHaveText(["普通 × 2全选", "天才 × 1全选"]);

  await page.locator('[data-toggle-dismiss-aptitude="普通"]').click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 2 名");
  await page.locator('[data-toggle-dismiss-aptitude="普通"]').click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 0 名");

  await page.locator('[data-toggle-dismiss="supporter"] strong').click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 1 名");

  await page.getByRole("button", { name: "清空选择" }).click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 0 名");

  await page.locator('[data-toggle-dismiss="implementer"]').click();
  await page.locator('[data-toggle-dismiss="supporter"]').click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 2 名");

  await page.getByRole("button", { name: "劝退选中" }).click();
  const benchStrip = page.locator(".bench-strip");
  await expect(benchStrip.getByRole("alert")).toContainText("稀有及以上资质学生");
  await expect(benchStrip.locator(".dismiss-footer").getByRole("button").last()).toHaveText("确认劝退");

  await page.getByRole("button", { name: "确认劝退" }).click();
  await expect(page.getByText("已劝退 2 名学生，共获得 2 份学生培养材料。")).toBeVisible();
  await expect(page.locator(".dismiss-tile")).toHaveCount(0);
});

test("batch dismissal supports selecting all bench students at once", async ({ page }) => {
  let current = profile();
  for (let i = 0; i < 60; i += 1) {
    current.students[`recruit-${i}`] = { ...current.students.planner, id: `recruit-${i}`, name: `学生${i}`, aptitude: i % 2 ? "优秀" : "普通" };
  }
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    if (path.includes("dismiss-batch")) {
      const body = route.request().postDataJSON();
      const ids = body.studentIds;
      for (const id of ids) delete current.students[id];
      current = { ...current, version: current.version + 1, inventory: { ...current.inventory, "student-training-material": (current.inventory["student-training-material"] ?? 0) + ids.length } };
      return json({ profile: current, dismissal: { studentIds: ids, itemId: "student-training-material", quantity: ids.length } });
    }
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.getByRole("button", { name: "批量劝退" }).click();
  await expect(page.locator(".dismiss-toolbar")).toContainText("共 63 名替补");

  await page.getByRole("button", { name: "全选全部替补" }).click();
  await expect(page.locator(".dismiss-footer")).toContainText("已选 63 名");
  await expect(page.getByRole("button", { name: "全不选" })).toBeVisible();

  await page.getByRole("button", { name: "劝退选中" }).click();
  await expect(page.getByText("已劝退 63 名学生，共获得 63 份学生培养材料。")).toBeVisible();
});

test("replace picker lists bench students by power", async ({ page }) => {
  let current = profile();
  current.students.supporter.abilities = { ...current.students.supporter.abilities, dynamicProgramming: 1200 };
  current.students.mathematician.abilities = { ...current.students.mathematician.abilities, dynamicProgramming: 1000 };
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile") return json(current);
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.getByRole("button", { name: "替换学生" }).click();
  await expect(page.locator(".replace-option strong")).toHaveText(["顾宁", "许知", "沈言"]);
});

test("energy tonic raises a student's max energy", async ({ page }) => {
  let current = profile();
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (path === "/auth/session") return authenticated ? json({ account: { id: "roster-account", username: "roster01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "roster-account", username: "roster01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/profile" && route.request().method() === "GET") return json(current);
    if (path === "/progression/shop/purchases") {
      current = { ...current, version: current.version + 1, currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins - 150 }, inventory: { ...current.inventory, "energy-tonic": (current.inventory["energy-tonic"] ?? 0) + 1 } };
      return json({ profile: current, offer: { id: "energy-tonic" } });
    }
    if (path === "/students/planner/energy" || path.endsWith("/planner/energy")) {
      const previousValue = current.students.planner.maxEnergy;
      current = { ...current, version: current.version + 1, students: { ...current.students, planner: { ...current.students.planner, maxEnergy: previousValue + 500 } }, inventory: { ...current.inventory, "energy-tonic": (current.inventory["energy-tonic"] ?? 1) - 1 } };
      return json({ profile: current, energy: { studentId: "planner", itemId: "energy-tonic", previousValue, currentValue: previousValue + 500, gain: 500 } });
    }
    return json({ code: "NOT_FOUND", message: path }, 404);
  });

  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();
  await page.locator('[data-buy-offer="energy-tonic"]').click();
  await expect(page.getByText("购买成功")).toBeVisible();

  await page.getByRole("link", { name: "学生名单", exact: true }).click();
  await expect(page.locator(".energy-panel")).toContainText("持有 1 份");
  await page.getByRole("button", { name: "使用精力药剂" }).click();
  await expect(page.getByText(/精力上限已提升：\d+ → \d+，已消耗 1 份精力药剂。/)).toBeVisible();
});

// ── Formation validation ─────────────────────────────────────────────────────

test("lineup editor allows fielding fewer than three students", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.getByRole("button", { name: "调整阵容" }).click();
  await expect(page.locator("[data-drag-student]")).toHaveCount(3);

  await page.locator('[data-bench-student="planner"]').click();
  await expect(page.getByText("阵容已调整。")).toBeVisible();

  await page.locator('[data-action="close-lineup-editor"]').click();
  await expect(page.locator(".roster-tab")).toHaveCount(2);
});

// ── Horizontal overflow check ────────────────────────────────────────────────

test("roster page has no horizontal overflow", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator(".roster-tab")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
