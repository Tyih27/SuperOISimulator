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
    schemaVersion: 3, version, accountId: "prog-account", identitySeed: "prog-test", namePoolVersion: 1,
    students: structuredClone(students), formation: { A1: "planner", A2: "graphist", A3: "structurer" },
    inventory: { "specialist-book-dynamicProgramming": 2 },
    currencies: { trainingCoins: 1000, recruitmentTickets: 2 },
    recruitment: { attemptsSinceGenius: 0 }, unlockedLevelIds: ["chapter-1-1"],
  };
}

async function mockApi(page, options = {}) {
  let current = profile();
  let authenticated = false;
  let checkInClaimed = false;

  await page.route("**/api/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace("/api/v1", "");
    const method = route.request().method();
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

    if (path === "/auth/session") return authenticated ? json({ account: { id: "prog-account", username: "prog01" } }) : json({ code: "UNAUTHENTICATED" }, 401);
    if (path === "/auth/register" || path === "/auth/login") { authenticated = true; return json({ account: { id: "prog-account", username: "prog01" } }, path.endsWith("register") ? 201 : 200); }
    if (path === "/auth/logout") { authenticated = false; return route.fulfill({ status: 204 }); }
    if (path === "/profile" && method === "GET") return json(current);

    if (path === "/progression/daily-check-in") {
      if (checkInClaimed) return json({ code: "DAILY_CHECK_IN_ALREADY_CLAIMED" }, 409);
      checkInClaimed = true;
      current = { ...current, version: current.version + 1, currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins + 1000 } };
      return json({ profile: current, reward: { trainingCoins: 1000 } });
    }

    if (path === "/progression/training/specialist") {
      const body = route.request().postDataJSON();
      const student = current.students[body.studentId];
      if (!student) return json({ code: "INVALID_PROGRESSION_REQUEST", message: "Student must be owned by the profile" }, 400);
      const bookId = `specialist-book-${body.ability}`;
      const hasBook = (current.inventory[bookId] ?? 0) > 0;
      const hasMaterial = (current.inventory["student-training-material"] ?? 0) > 0;
      if (!hasBook && !hasMaterial) return json({ code: "INVALID_PROGRESSION_REQUEST", message: "A matching specialist training book or student training material is required" }, 400);
      const prev = student.abilities[body.ability];
      const next = { ...current, version: current.version + 1, students: { ...current.students, [body.studentId]: { ...student, abilities: { ...student.abilities, [body.ability]: prev + 40 } } } };
      if (hasBook) next.inventory = { ...next.inventory, [bookId]: (next.inventory[bookId] ?? 1) - 1 };
      else next.inventory = { ...next.inventory, "student-training-material": (next.inventory["student-training-material"] ?? 1) - 1 };
      current = next;
      return json({ profile: current, training: { studentId: body.studentId, ability: body.ability, itemId: hasBook ? bookId : "student-training-material", previousValue: prev, currentValue: prev + 40, increment: 40 } });
    }

    if (path === "/progression/shop/purchases") {
      const body = route.request().postDataJSON();
      if (body.offerId === "daily-dp-book") {
        current = { ...current, version: current.version + 1, currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins - 120 }, inventory: { ...current.inventory, "specialist-book-dynamicProgramming": (current.inventory["specialist-book-dynamicProgramming"] ?? 0) + 1 } };
        return json({ profile: current, offer: { id: "daily-dp-book" } });
      }
      if (body.offerId === "recruitment-right") {
        current = { ...current, version: current.version + 1, currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins - 300, recruitmentTickets: current.currencies.recruitmentTickets + 1 } };
        return json({ profile: current, offer: { id: "recruitment-right" } });
      }
      if (body.offerId === "energy-tonic") {
        current = { ...current, version: current.version + 1, currencies: { ...current.currencies, trainingCoins: current.currencies.trainingCoins - 150 }, inventory: { ...current.inventory, "energy-tonic": (current.inventory["energy-tonic"] ?? 0) + 1 } };
        return json({ profile: current, offer: { id: "energy-tonic" } });
      }
      return json({ code: "INVALID_PROGRESSION_REQUEST", message: "Unknown shop offer" }, 400);
    }

    if (path === "/progression/recruitment") {
      if (current.currencies.recruitmentTickets < 1) return json({ code: "INVALID_PROGRESSION_REQUEST", message: "Not enough recruitment tickets" }, 400);
      const id = `recruit-${Date.now()}`;
      const student = { ...current.students.planner, id, name: "新招募", aptitude: "天才" };
      current = { ...current, version: current.version + 1, students: { ...current.students, [id]: student }, currencies: { ...current.currencies, recruitmentTickets: current.currencies.recruitmentTickets - 1 }, recruitment: { attemptsSinceGenius: 0 } };
      return json({ profile: current, student, recruitment: { aptitude: "天才", attemptsSinceGenius: 0 } });
    }

    if (path.includes("/dismiss")) {
      const studentId = decodeURIComponent(path.split("/").at(-2));
      const { [studentId]: _, ...rest } = current.students;
      current = { ...current, version: current.version + 1, students: rest, inventory: { ...current.inventory, "student-training-material": (current.inventory["student-training-material"] ?? 0) + 1 } };
      return json({ profile: current, dismissal: { studentId, itemId: "student-training-material", quantity: 1 } });
    }

    return json({ code: "NOT_FOUND", message: path }, 404);
  });
}

async function login(page) {
  await page.goto("/");
  await page.getByLabel("用户名").fill("prog01");
  await page.getByLabel("密码").fill("correct horse battery");
  await page.getByRole("button", { name: "注册并登录" }).click();
  await expect(page.getByRole("link", { name: "训练与补给" })).toBeVisible();
}

// ── Daily check-in ───────────────────────────────────────────────────────────

test("daily check-in awards training coins", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByText("1,000")).toBeVisible();

  await page.getByRole("button", { name: "领取今日奖励" }).click();
  await expect(page.getByText("签到成功，获得 1000 训练币")).toBeVisible();
  await expect(page.getByText("2000")).toBeVisible();
});

test("duplicate daily check-in shows already claimed", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();

  await page.getByRole("button", { name: "领取今日奖励" }).click();
  await expect(page.getByText("签到成功")).toBeVisible();

  await page.getByRole("button", { name: "领取今日奖励" }).click();
  await expect(page.getByText("今日签到奖励已领取")).toBeVisible();
});

// ── Specialist training ──────────────────────────────────────────────────────

test("specialist training via roster dossier consumes book", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "学生名单" }).click();
  await page.getByRole("button", { name: "提升", exact: true }).click();
  await page.locator('input[name="enhance-ability"][value="dynamicProgramming"]').check();
  await page.getByRole("button", { name: "确认提升" }).click();

  await expect(page.getByText(/学生强化完成，数值 820 → 860/)).toBeVisible();
});

// ── Shop purchase ────────────────────────────────────────────────────────────

test("shop offers can be purchased repeatedly", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();

  const firstOffer = page.locator(".shop-offer").first();
  await firstOffer.locator("button").click();
  await expect(page.getByText("购买成功")).toBeVisible();

  await page.locator('[data-buy-offer="daily-dp-book"]').click();
  await expect(page.locator(".app-message").getByText("购买成功")).toBeVisible();
});

test("recruitment right purchase increases tickets", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();

  await page.locator('[data-buy-offer="recruitment-right"]').click();
  await expect(page.getByText("购买成功")).toBeVisible();
});

// ── Recruitment ──────────────────────────────────────────────────────────────

test("recruit student and show pity status", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();

  await expect(page.locator(".resource-strip").getByText("天才保底")).toBeVisible();

  await page.getByRole("button", { name: "使用招募券" }).click();
  await expect(page.getByText(/已招募一名天才学生/)).toBeVisible();
});

// ── Inventory display ────────────────────────────────────────────────────────

test("inventory shows items after training", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();

  await expect(page.locator(".inventory-list").getByText("动态规划专项训练册")).toBeVisible();
});

// ── Horizontal overflow ──────────────────────────────────────────────────────

test("progression page has no horizontal overflow", async ({ page }) => {
  await mockApi(page);
  await login(page);
  await page.getByRole("link", { name: "训练与补给" }).click();
  await expect(page.getByRole("heading", { name: "进度管理" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
