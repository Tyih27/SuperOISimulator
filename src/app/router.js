import { ApiError } from "../api/client.js";
import { createAuthSession, renderAccountScreen, renderAuthScreen } from "./auth.js";
import { getLevel, renderCampaign } from "./campaign.js";
import { renderProgression, renderRoster } from "./progression.js";
import { renderArena } from "./arena.js";

const ROUTES = new Set(["campaign", "roster", "progression", "account", "battle", "arena"]);
const POSITIONS = ["A1", "A2", "A3"];

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function messageFor(error) {
  if (error instanceof ApiError) return error.message;
  return "无法连接到训练服务，请检查服务是否已启动。";
}

function initialFormation(profile) {
  return { teamIds: POSITIONS.map((slot) => profile.formation[slot]), formation: { ...profile.formation } };
}

function isValidFormation(draft) {
  const placed = POSITIONS.map((slot) => draft.formation[slot]);
  return draft.teamIds.length === 3
    && new Set(draft.teamIds).size === 3
    && placed.every(Boolean)
    && new Set(placed).size === 3
    && placed.every((studentId) => draft.teamIds.includes(studentId));
}

function renderShell({ account, route, content }) {
  return `<a class="skip-link" href="#main-content">跳到主要内容</a><div class="account-shell"><header class="account-topbar"><a class="app-brand" href="#campaign">SUPER OI <span>SIMULATOR</span></a><nav aria-label="主导航"><a href="#campaign"${route === "campaign" ? " aria-current=\"page\"" : ""}>主线关卡</a><a href="#arena"${route === "arena" ? " aria-current=\"page\"" : ""}>异步竞技场</a><a href="#roster"${route === "roster" ? " aria-current=\"page\"" : ""}>学生名单</a><a href="#progression"${route === "progression" ? " aria-current=\"page\"" : ""}>训练与补给</a><a href="#account"${route === "account" ? " aria-current=\"page\"" : ""}>账户与数据</a></nav><div class="account-actions"><span>${esc(account.username)}</span><button class="icon-button" type="button" data-action="logout" aria-label="退出登录" title="退出登录">退出</button></div></header><main id="main-content" class="account-main">${content}</main></div>`;
}

function downloadJson(value, filename) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function renderBattle({ battle, message }) {
  const result = battle.settlement?.result;
  const reward = battle.settlement?.reward ?? {};
  return `<section class="app-view battle-replay" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">服务端战斗记录</p><h1 id="battle-title">${esc(battle.snapshot.level.name)}</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>战斗编号</span><strong class="mono">${esc(battle.id)}</strong></div><div><span>固定种子</span><strong>${esc(battle.snapshot.seed)}</strong></div><div><span>队伍</span><strong>${battle.snapshot.team.map((student) => esc(student.name)).join(" / ")}</strong></div></div>${result ? `<section class="settled-result ${result.result === "win" ? "is-win" : "is-lose"}"><h2>${result.result === "win" ? "挑战胜利" : "挑战失败"}</h2><p>${result.result === "win" ? `获得 ${reward.trainingCoins ?? 0} 训练币。` : "本次未获得关卡奖励。"}</p><dl><div><dt>完成题目</dt><dd>${result.completedCount}</dd></div><div><dt>结束回合</dt><dd>${result.round}</dd></div><div><dt>剩余精力</dt><dd>${result.remainingEnergy}</dd></div></dl></section><section class="event-replay"><h2>战斗回放</h2><ol>${result.events.map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(event.type)}${event.actor ? ` · ${esc(event.actor)}` : ""}</li>`).join("")}</ol></section>` : `<section class="battle-ready"><h2>快照已锁定</h2><p>队伍、关卡和随机种子已由服务端记录。结算只会使用这份不可变快照。</p><button class="primary-button" type="button" data-action="settle-battle">开始回放并结算</button></section>`}</section>`;
}

export class AppRouter {
  constructor({ root, client }) {
    if (!root) throw new Error("AppRouter requires a root element");
    this.root = root;
    this.client = client;
    this.auth = createAuthSession(client);
    this.account = null;
    this.profile = null;
    this.route = "campaign";
    this.selectedLevelId = null;
    this.formationDraft = null;
    this.battle = null;
    this.arena = { defense: null, opponents: [], match: null, replay: null };
    this.message = "";
    this.root.addEventListener("submit", (event) => this.onSubmit(event));
    this.root.addEventListener("click", (event) => this.onClick(event));
    this.root.addEventListener("change", (event) => this.onChange(event));
    globalThis.addEventListener?.("hashchange", () => this.applyHash());
  }

  async start() {
    this.renderLoading();
    try {
      const session = await this.auth.restore();
      this.account = session.account;
      await this.loadProfile();
      this.applyHash();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.account = null;
        this.render();
        return;
      }
      this.account = null;
      this.message = messageFor(error);
      this.render();
    }
  }

  async loadProfile() {
    this.profile = await this.client.get("/profile");
    this.selectedLevelId ??= this.profile.unlockedLevelIds[0];
    this.formationDraft = initialFormation(this.profile);
  }

  applyHash() {
    if (!this.account) return;
    const candidate = globalThis.location?.hash?.slice(1) || "campaign";
    this.route = ROUTES.has(candidate) ? candidate : "campaign";
    if (this.route === "battle" && !this.battle) this.route = "campaign";
    this.render();
  }

  navigate(route) {
    if (globalThis.location) globalThis.location.hash = route;
    this.route = route;
    this.render();
  }

  renderLoading() {
    this.root.innerHTML = `<main class="auth-page"><p class="app-message" role="status">正在连接训练服务...</p></main>`;
  }

  render() {
    if (!this.account) {
      this.root.innerHTML = renderAuthScreen({ message: this.message });
      return;
    }
    let content;
    if (this.route === "roster") content = renderRoster({ profile: this.profile, message: this.message });
    else if (this.route === "progression") content = renderProgression({ profile: this.profile, message: this.message });
    else if (this.route === "account") content = renderAccountScreen({ account: this.account, message: this.message });
    else if (this.route === "battle" && this.battle) content = renderBattle({ battle: this.battle, message: this.message });
    else if (this.route === "arena") content = renderArena({ profile: this.profile, ...this.arena, message: this.message });
    else content = renderCampaign({ profile: this.profile, selectedLevelId: this.selectedLevelId, ...this.formationDraft, message: this.message });
    this.root.innerHTML = renderShell({ account: this.account, route: this.route, content });
  }

  async onSubmit(event) {
    const form = event.target.closest("[data-auth-form], [data-account-form]");
    if (!form) return;
    event.preventDefault();
    if (form.dataset.accountForm) {
      await this.submitAccountForm(form);
      return;
    }
    const submitter = event.submitter;
    const credentials = Object.fromEntries(new FormData(form));
    try {
      const result = submitter?.value === "register" ? await this.auth.register(credentials) : await this.auth.login(credentials);
      this.account = result.account;
      this.message = "登录成功。";
      await this.loadProfile();
      this.navigate("campaign");
    } catch (error) {
      this.message = messageFor(error);
      this.render();
    }
  }

  async onClick(event) {
    const button = event.target.closest("button, a[data-action]");
    if (!button) return;
    if (button.matches("[data-select-level]")) {
      this.selectedLevelId = button.dataset.selectLevel;
      this.message = "";
      this.render();
      return;
    }
    const action = button.dataset.action;
    if (!action && !button.dataset.opponentId && !button.dataset.buyOffer && !button.dataset.saveName) return;
    event.preventDefault();
    try {
      if (action === "logout") {
        await this.auth.logout();
        this.account = null;
        this.profile = null;
        this.battle = null;
        this.message = "已退出登录。";
      } else if (action === "save-formation") {
        await this.saveFormation();
      } else if (action === "start-battle") {
        await this.startBattle();
      } else if (action === "settle-battle") {
        await this.settleBattle();
      } else if (action === "load-arena-opponents") {
        this.arena.opponents = await this.client.get("/arena/opponents");
        this.message = "对手列表已刷新。";
      } else if (action === "save-arena-defense") {
        const saved = await this.client.put("/arena/defense", { version: this.profile.version, teamIds: POSITIONS.map((slot) => this.profile.formation[slot]), formation: this.profile.formation });
        this.arena.defense = saved.defense;
        this.message = "防守编队已锁定。";
      } else if (action === "settle-arena") {
        this.arena.replay = await this.client.post(`/arena/matches/${this.arena.match.id}/settle`, {});
        this.message = "竞技场回放已结算。";
      } else if (action === "export-account") {
        const exported = await this.client.get("/account/export");
        downloadJson(exported, `super-oi-${this.account.id}.json`);
        this.message = "训练数据已下载。";
      } else if (action === "train") {
        await this.train();
      } else if (action === "recruit") {
        await this.recruit();
      } else if (button.dataset.opponentId) {
        this.arena.match = await this.client.post("/arena/matches", { opponentId: button.dataset.opponentId });
        this.arena.replay = null;
        this.message = "比赛快照已锁定。";
      } else if (button.dataset.buyOffer) {
        await this.buy(button.dataset.buyOffer);
      } else if (button.dataset.saveName) {
        await this.saveName(button.dataset.saveName);
      }
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  onChange(event) {
    const checkbox = event.target.closest("[data-student-toggle]");
    if (checkbox) {
      const studentId = checkbox.value;
      const teamIds = this.formationDraft.teamIds;
      if (checkbox.checked) {
        if (teamIds.length >= 3) {
          checkbox.checked = false;
          this.message = "每场挑战只能选择 3 名学生。";
        } else teamIds.push(studentId);
      } else {
        this.formationDraft.teamIds = teamIds.filter((id) => id !== studentId);
        for (const slot of POSITIONS) if (this.formationDraft.formation[slot] === studentId) this.formationDraft.formation[slot] = null;
      }
      this.render();
      return;
    }
    const selector = event.target.closest("[data-position]");
    if (selector) {
      this.formationDraft.formation[selector.dataset.position] = selector.value || null;
      this.message = "";
      this.render();
    }
  }

  async saveFormation() {
    if (!isValidFormation(this.formationDraft)) throw new Error("请安排 3 名不同学生到 A1、A2、A3 站位。");
    this.profile = await this.client.put("/profile", { version: this.profile.version, formation: this.formationDraft.formation });
    this.formationDraft = initialFormation(this.profile);
    this.message = "编队已保存。";
  }

  async startBattle() {
    await this.saveFormation();
    const started = await this.client.post("/campaign/battles", {
      levelId: this.selectedLevelId,
      teamIds: this.formationDraft.teamIds,
      formation: this.formationDraft.formation,
    });
    this.battle = { ...started, settlement: null };
    this.message = "战斗快照已由服务端创建。";
    this.navigate("battle");
  }

  async settleBattle() {
    this.battle.settlement = await this.client.post(`/campaign/battles/${this.battle.id}/settle`);
    if (this.battle.settlement.profile) {
      this.profile = this.battle.settlement.profile;
      this.formationDraft = initialFormation(this.profile);
    }
    this.message = "服务端结算已完成。";
  }

  async saveName(studentId) {
    const input = this.root.querySelector(`[data-name-input="${studentId}"]`);
    this.profile = await this.client.put("/profile", { version: this.profile.version, students: { [studentId]: { name: input?.value ?? "" } } });
    this.formationDraft = initialFormation(this.profile);
    this.message = "学生名称已保存。";
  }

  async train() {
    const studentId = this.root.querySelector("#training-student").value;
    const ability = this.root.querySelector("#training-ability").value;
    const result = await this.client.post("/progression/training/specialist", { studentId, ability });
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.message = "专项训练已完成。";
  }

  async buy(offerId) {
    const result = await this.client.post("/progression/shop/purchases", { offerId });
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.message = "购买成功。";
  }

  async recruit() {
    const result = await this.client.post("/progression/recruitment", {});
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.message = "已招募一名新学生。";
  }

  async submitAccountForm(form) {
    const values = Object.fromEntries(new FormData(form));
    try {
      if (form.dataset.accountForm === "password-change") {
        await this.client.post("/account/password", {
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        });
        this.account = null;
        this.profile = null;
        this.battle = null;
        this.message = "密码已更新，请使用新密码重新登录。";
      } else if (form.dataset.accountForm === "account-deletion") {
        if (values.confirmed !== "on") throw new Error("请确认删除账户请求。");
        const result = await this.client.delete("/account", { password: values.password });
        this.account = null;
        this.profile = null;
        this.battle = null;
        this.message = `删除请求已提交，计划处理时间：${new Date(result.deleteAfter).toLocaleString("zh-CN")}。`;
      }
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }
}

export function createRouter(options) {
  return new AppRouter(options);
}
