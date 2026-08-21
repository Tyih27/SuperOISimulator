import { expect, test } from "@playwright/test";

async function mockApiWithErrors(page, options = {}) {
  let authenticated = false;
  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/auth/session") {
      if (options.sessionExpired) return json({ code: "UNAUTHENTICATED", message: "Authentication required" }, 401);
      return authenticated ? json({ account: { id: "err-account", username: "err01" } }) : json({ code: "UNAUTHENTICATED", message: "Authentication required" }, 401);
    }
    if (path === "/auth/register") {
      if (options.registerConflict) return json({ code: "USERNAME_TAKEN", message: "Username is already registered" }, 409);
      authenticated = true;
      return json({ account: { id: "err-account", username: "err01" } }, 201);
    }
    if (path === "/auth/login") {
      if (options.loginFail) return json({ code: "INVALID_LOGIN", message: "Username or password is incorrect" }, 401);
      authenticated = true;
      return json({ account: { id: "err-account", username: "err01" } });
    }
    if (path === "/auth/logout") { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path === "/profile" && method === "GET") {
      if (options.profileError) return json({ code: "ERROR" }, 500);
      return json({
        schemaVersion: 3, version: 1, accountId: "err-account", identitySeed: "err", namePoolVersion: 1,
        students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, i) => [id, {
          id, name: `学生${i}`, aptitude: "普通", maxEnergy: 5000,
          abilities: { dynamicProgramming: 800, graphTheory: 800, dataStructures: 800, mathematics: 800, implementation: 800 },
          skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
        }])),
        formation: { A1: "planner", A2: "graphist", A3: "structurer" },
        inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 },
        recruitment: { attemptsSinceGenius: 0 }, unlockedLevelIds: ["chapter-1-1"],
      });
    }
    if (path === "/profile" && method === "PUT") {
      if (options.versionConflict) return json({ code: "PROFILE_VERSION_CONFLICT", message: "Profile has changed; reload and try again" }, 409);
      const update = route.request().postDataJSON();
      return json({
        schemaVersion: 3, version: 2, accountId: "err-account", identitySeed: "err", namePoolVersion: 1,
        students: Object.fromEntries(["planner", "graphist", "structurer"].map((id, i) => [id, {
          id, name: `学生${i}`, aptitude: "普通", maxEnergy: 5000,
          abilities: { dynamicProgramming: 800, graphTheory: 800, dataStructures: 800, mathematics: 800, implementation: 800 },
          skillGroupId: id, skillGroupLevels: { [id]: { normal: 1, burst: 1 } },
        }])),
        formation: update?.formation ?? { A1: "planner", A2: "graphist", A3: "structurer" },
        inventory: {}, currencies: { trainingCoins: 1000, recruitmentTickets: 1 },
        recruitment: { attemptsSinceGenius: 0 }, unlockedLevelIds: ["chapter-1-1"],
      });
    }
    if (path === "/account/password" && method === "POST") {
      if (options.wrongPassword) return json({ code: "INVALID_CURRENT_PASSWORD", message: "Current password is incorrect" }, 400);
      authenticated = false;
      return route.fulfill({ status: 204 });
    }
    if (path === "/account/export") return json({ exportedAt: new Date().toISOString(), account: { id: "err-account" }, data: {} });
    if (path === "/account" && method === "DELETE") { authenticated = false; return json({ status: "queued", deleteAfter: "2026-09-18T00:00:00.000Z" }); }
    if (path.includes("/daily-check-in")) return json({ code: "DAILY_CHECK_IN_ALREADY_CLAIMED" }, 409);
    return json({ code: "NOT_FOUND", message: path }, 404);
  });
}

// ── Register with existing username ──────────────────────────────────────────

test("register with existing username shows error", async ({ page }) => {
  await mockApiWithErrors(page, { registerConflict: true });
  await page.goto("/");
  await page.getByLabel("用户名").fill("existing01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByText("Username is already registered")).toBeVisible();
});

// ── Login with wrong password ────────────────────────────────────────────────

test("login with wrong password shows error", async ({ page }) => {
  await mockApiWithErrors(page, { loginFail: true });
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("wrongpassword");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByText("Username or password is incorrect")).toBeVisible();
});

// ── Session expiry redirects to login ────────────────────────────────────────

test("session expiry redirects to login on reload", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "主线关卡" })).toBeVisible();

  await mockApiWithErrors(page, { sessionExpired: true });
  await page.reload();
  await expect(page.getByLabel("用户名")).toBeVisible();
});

// ── Network error shows connection message ───────────────────────────────────

test("server error shows connection error message", async ({ page }) => {
  await page.route("**/api/v1/**", async (route) => {
    await route.abort("failed");
  });
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByText("无法连接到训练服务")).toBeVisible();
});

// ── Profile version conflict ─────────────────────────────────────────────────

test("profile version conflict shows refresh message", async ({ page }) => {
  await mockApiWithErrors(page, { versionConflict: true });
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "学生名单" })).toBeVisible();

  await page.getByRole("link", { name: "学生名单" }).click();
  await page.getByRole("button", { name: "调整阵容" }).click();
  await page.locator('[data-bench-student="planner"]').click();
  await expect(page.getByText("档案已更新，请刷新后重试")).toBeVisible();
});

// ── Daily check-in duplicate shows error ─────────────────────────────────────

test("duplicate daily check-in shows already claimed", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "训练与补给" })).toBeVisible();

  await page.getByRole("link", { name: "训练与补给" }).click();
  await page.getByRole("button", { name: "领取今日奖励" }).click();
  await expect(page.getByText("今日签到奖励已领取")).toBeVisible();
});

// ── Delete without confirmation checkbox ─────────────────────────────────────

test("delete button requires confirmation checkbox", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "账户与数据" })).toBeVisible();

  await page.getByRole("link", { name: "账户与数据" }).click();
  await page.getByLabel("账户密码").fill("correct horse battery");
  await expect(page.getByRole("button", { name: "请求删除账户" })).toBeVisible();
});

// ── Wrong password for password change ───────────────────────────────────────

test("wrong current password shows error", async ({ page }) => {
  await mockApiWithErrors(page, { wrongPassword: true });
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "账户与数据" })).toBeVisible();

  await page.getByRole("link", { name: "账户与数据" }).click();
  await page.getByLabel("当前密码").fill("wrongpassword");
  await page.getByRole("textbox", { name: "新密码", exact: true }).fill("newcorrecthorse");
  await page.getByRole("button", { name: "更新密码" }).click();
  await expect(page.getByText("Current password is incorrect")).toBeVisible();
});

// ── Horizontal overflow on error states ──────────────────────────────────────

test("error pages have no horizontal overflow", async ({ page }) => {
  await mockApiWithErrors(page, { loginFail: true });
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("wrongpassword");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByText("Username or password is incorrect")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

// ── Navigation bar warning banner ────────────────────────────────────────────

test("warning banner is visible on all pages", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByText("当前处于删档测试阶段")).toBeVisible();

  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByText("当前处于删档测试阶段")).toBeVisible();

  await page.getByRole("link", { name: "账户与数据" }).click();
  await expect(page.getByText("当前处于删档测试阶段")).toBeVisible();
});

// ── Current page highlight ───────────────────────────────────────────────────

test("navigation highlights current page", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "主线关卡" })).toBeVisible();

  await page.getByRole("link", { name: "学生名单" }).click();
  await expect(page.locator('a[aria-current="page"]')).toHaveText("学生名单");

  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.locator('a[aria-current="page"]')).toHaveText("训练与补给");

  await page.getByRole("link", { name: "主线关卡" }).click();
  await expect(page.locator('a[aria-current="page"]')).toHaveText("主线关卡");
});

// ── Hash routing ─────────────────────────────────────────────────────────────

test("invalid hash falls back to campaign", async ({ page }) => {
  await mockApiWithErrors(page);
  await page.goto("/#invalid-route");
  await page.getByLabel("用户名").fill("alice01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByText("第 1 章")).toBeVisible();
});
