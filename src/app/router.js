import { ApiError } from "../api/client.js";
import { createAuthSession, renderAccountScreen, renderAuthScreen } from "./auth.js";
import { getLevel, renderCampaign } from "./campaign.js";
import { renderProgression, renderRoster, renderStudentDetail } from "./progression.js";
import { renderArena } from "./arena.js";
import { createPlayback } from "./state.js";

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

const EVENT_LABELS = Object.freeze({
  round_start: "回合开始",
  stage_start: "阶段开始",
  action: "发动技能",
  skip: "跳过行动",
  effect: "状态变化",
  problem_completed: "题目完成",
  student_exit: "学生退场",
  round_end: "回合结束",
  battle_end: "战斗结束",
});

function createBattlePlayback(snapshot) {
  if (!snapshot?.level?.topics || !snapshot?.team?.length || !snapshot?.skillGroups) return null;
  const teamIds = snapshot.team.map((student) => student.id);
  const playback = createPlayback({
    teamIds,
    positions: snapshot.formation,
    combatOptions: {
      level: snapshot.level,
      seed: snapshot.seed,
      students: snapshot.team,
      skillGroups: snapshot.skillGroups,
      topics: snapshot.level.topics,
      maxRounds: snapshot.level.maxRounds,
      focusMax: snapshot.level.focusMax,
      goal: {
        type: snapshot.level.objective.type,
        target: snapshot.level.objective.requiredTopics,
      },
    },
  });
  playback.prepare();
  return playback;
}

function percent(value, max) {
  const numeric = Number(value);
  const limit = Math.max(1, Number(max) || 1);
  return Math.max(0, Math.min(100, (numeric / limit) * 100));
}

function renderLiveBattle({ battle, state }) {
  if (!state?.combat) return "";
  const students = battle.snapshot.team;
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const runtimeStudents = state.combat.state?.students ?? {};
  const problems = state.combat.state?.problems ?? {};
  const activeProblems = Object.entries(state.combat.state?.activeProblems ?? {})
    .map(([slot, id]) => ({ slot, problem: id ? problems[id] : null }))
    .filter(({ problem }) => problem);
  const events = state.combat.events ?? [];
  const isDone = state.phase === "result";
  return `<section class="live-battle panel" aria-labelledby="live-battle-title">
    <div class="panel-header"><div><p class="eyebrow">${isDone ? "战斗已结束" : "实时对战"}</p><h2 id="live-battle-title">${isDone ? "战斗结果已就绪" : "对战过程"}</h2></div><span class="panel-meta">${esc(state.phase)} · ${esc(state.stepCount)} 步</span></div>
    <div class="live-battle-toolbar"><span class="live-status" role="status" aria-live="polite">${esc(state.lastEvent ? `${EVENT_LABELS[state.lastEvent.type] ?? state.lastEvent.type}${state.lastEvent.round ? ` · 第 ${state.lastEvent.round} 回合` : ""}` : "准备中")}</span><div class="battle-controls"><button class="secondary-button" type="button" data-action="${state.playing ? "pause-live-battle" : "start-live-battle"}"${isDone ? " disabled" : ""}>${state.playing ? "暂停" : "播放"}</button><button class="secondary-button" type="button" data-action="step-live-battle"${isDone ? " disabled" : ""}>单步</button><button class="secondary-button" type="button" data-action="restart-live-battle">重播</button></div></div>
    <div class="live-battle-grid"><div><h3>我方队伍</h3><div class="live-student-list">${students.map((student) => {
      const runtime = runtimeStudents[student.id] ?? { energy: student.maxEnergy, focus: 0, alive: true };
      return `<article class="live-student ${runtime.alive ? "" : "is-inactive"}"><div class="student-card-head"><strong>${esc(student.name)}</strong><span class="alive-state">${runtime.alive ? "做题中" : "已退场"}</span></div><div class="stat-line"><span>精力</span><strong>${Math.round(runtime.energy)} / ${student.maxEnergy}</strong></div><div class="meter energy"><span style="width:${percent(runtime.energy, student.maxEnergy)}%"></span></div><div class="stat-line"><span>专注</span><strong>${Math.round(runtime.focus ?? 0)}</strong></div><div class="meter focus"><span style="width:${percent(runtime.focus, state.combat.state?.focusMax ?? 1000)}%"></span></div></article>`;
    }).join("")}</div></div><div><h3>题目战线</h3><div class="live-topic-list">${activeProblems.map(({ slot, problem }) => `<article class="live-topic ${problem.passed ? "is-complete" : ""}"><div class="topic-name-row"><strong>${esc(problem.name)}</strong><span class="position-badge">${slot}</span></div><div class="topic-progress-label"><span>${problem.passed ? "已完成" : "推进度"}</span><strong>${Math.round(percent(problem.progress, problem.maxProgress))}%</strong></div><div class="topic-progress"><span style="width:${percent(problem.progress, problem.maxProgress)}%"></span></div></article>`).join("") || `<p class="empty-state">等待题目进入战线。</p>`}</div></div></div>
    <details class="live-event-log" open><summary>事件记录（${events.length}）</summary><ol class="event-replay">${events.slice(-30).map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(EVENT_LABELS[event.type] ?? event.type)}${event.actor ? ` · ${esc(studentNames.get(event.actor) ?? "未知学生")}` : ""}</li>`).join("")}</ol></details>
  </section>`;
}

function renderBattle({ battle, message }) {
  const result = battle.settlement?.result;
  const reward = battle.settlement?.reward ?? {};
  const studentNames = new Map((battle.snapshot.team ?? []).map((student) => [student.id, student.name]));
  const liveState = battle.playbackState;
  return `<section class="app-view battle-replay" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">服务端战斗记录</p><h1 id="battle-title">${esc(battle.snapshot.level.name)}</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>战斗编号</span><strong class="mono">${esc(battle.id)}</strong></div><div><span>本局 seed</span><strong>${esc(battle.snapshot.seed)}</strong></div><div><span>队伍</span><strong>${battle.snapshot.team.map((student) => esc(student.name)).join(" / ")}</strong></div></div>${liveState ? renderLiveBattle({ battle, state: liveState }) : ""}${result ? `<section class="settled-result ${result.result === "win" ? "is-win" : "is-lose"}"><h2>${result.result === "win" ? "挑战胜利" : "挑战失败"}</h2><p>${result.result === "win" ? `获得 ${reward.trainingCoins ?? 0} 训练币。` : "本次未获得关卡奖励。"}</p><dl><div><dt>完成题目</dt><dd>${result.completedCount}</dd></div><div><dt>结束回合</dt><dd>${result.round}</dd></div><div><dt>剩余精力</dt><dd>${result.remainingEnergy}</dd></div></dl></section><section class="event-replay"><h2>服务端回放</h2><ol>${result.events.map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(EVENT_LABELS[event.type] ?? event.type)}${event.actor ? ` · ${esc(studentNames.get(event.actor) ?? "未知学生")}` : ""}</li>`).join("")}</ol></section>` : `<section class="battle-ready"><h2>快照已锁定</h2><p>队伍、关卡和本局 seed 已由服务端记录。结算与回放始终使用这份不可变快照。</p><button class="primary-button" type="button" data-action="settle-battle">开始回放并结算</button></section>`}</section>`;
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
    this.rosterEditing = false;
    this.detailStudentId = null;
    this.dragStudentId = null;
    this.battle = null;
    this.arena = { defense: null, opponents: [], match: null, replay: null };
    this.message = "";
    this.root.addEventListener("submit", (event) => this.onSubmit(event));
    this.root.addEventListener("click", (event) => this.onClick(event));
    this.root.addEventListener("change", (event) => this.onChange(event));
    this.root.addEventListener("keydown", (event) => this.onKeyDown(event));
    this.root.addEventListener("dragstart", (event) => this.onDragStart(event));
    this.root.addEventListener("dragover", (event) => this.onDragOver(event));
    this.root.addEventListener("dragleave", (event) => this.onDragLeave(event));
    this.root.addEventListener("drop", (event) => this.onDrop(event));
    this.root.addEventListener("dragend", (event) => this.onDragEnd(event));
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
    if (this.detailStudentId && !this.profile.students?.[this.detailStudentId]) this.detailStudentId = null;
    this.selectedLevelId ??= this.profile.unlockedLevelIds[0];
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
  }

  applyHash() {
    if (!this.account) return;
    const candidate = globalThis.location?.hash?.slice(1) || "campaign";
    this.route = ROUTES.has(candidate) ? candidate : "campaign";
    if (this.route === "battle" && !this.battle) this.route = "campaign";
    this.render();
  }

  navigate(route) {
    if (route !== "battle") this.battle?.playback?.pause();
    if (route !== "roster") this.detailStudentId = null;
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
    if (this.route === "roster") content = renderRoster({ profile: this.profile, ...this.formationDraft, editing: this.rosterEditing, message: this.message });
    else if (this.route === "progression") content = renderProgression({ profile: this.profile, message: this.message });
    else if (this.route === "account") content = renderAccountScreen({ account: this.account, message: this.message });
    else if (this.route === "battle" && this.battle) content = renderBattle({ battle: this.battle, message: this.message });
    else if (this.route === "arena") content = renderArena({ profile: this.profile, ...this.arena, message: this.message });
    else content = renderCampaign({ profile: this.profile, selectedLevelId: this.selectedLevelId, ...this.formationDraft, message: this.message });
    const detailStudent = this.route === "roster" && this.detailStudentId ? this.profile.students?.[this.detailStudentId] : null;
    this.root.innerHTML = renderShell({ account: this.account, route: this.route, content: `${content}${renderStudentDetail({ student: detailStudent })}` });
    if (detailStudent) this.root.querySelector("[data-student-detail-close]")?.focus();
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
    const overlay = event.target.closest("[data-student-detail-overlay]");
    if (overlay && event.target === overlay) {
      event.preventDefault();
      this.detailStudentId = null;
      this.render();
      return;
    }
    const button = event.target.closest("button, a[data-action]");
    if (!button) return;
    if (button.matches("[data-student-detail]")) {
      event.preventDefault();
      event.stopPropagation();
      this.detailStudentId = button.dataset.studentDetail;
      this.render();
      return;
    }
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
        this.battle?.playback?.pause();
        this.battle = null;
        this.rosterEditing = false;
        this.detailStudentId = null;
        this.message = "已退出登录。";
      } else if (action === "close-student-detail") {
        this.detailStudentId = null;
        this.message = "";
      } else if (action === "cancel-student-rename") {
        this.message = "已取消名称修改。";
        this.detailStudentId = null;
      } else if (action === "edit-roster") {
        this.rosterEditing = true;
        this.message = "请选择新的三人队伍。";
      } else if (action === "cancel-roster-edit") {
        this.formationDraft = initialFormation(this.profile);
        this.rosterEditing = false;
        this.message = "已取消队伍调整。";
      } else if (action === "save-formation") {
        await this.saveFormation();
      } else if (action === "start-battle") {
        await this.startBattle();
      } else if (action === "settle-battle") {
        await this.settleBattle();
      } else if (action === "start-live-battle") {
        this.battle?.playback?.start();
        this.message = "正在播放本局对战。";
      } else if (action === "pause-live-battle") {
        this.battle?.playback?.pause();
        this.message = "对战播放已暂停。";
      } else if (action === "step-live-battle") {
        this.battle?.playback?.step();
        this.message = "已推进一个对战阶段。";
      } else if (action === "restart-live-battle") {
        this.battle?.playback?.restart();
        this.message = "已使用本局 seed 重播。";
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
        } else {
          teamIds.push(studentId);
          const openSlot = POSITIONS.find((slot) => !this.formationDraft.formation[slot]);
          if (openSlot) this.formationDraft.formation[openSlot] = studentId;
        }
      } else {
        this.formationDraft.teamIds = teamIds.filter((id) => id !== studentId);
        for (const slot of POSITIONS) if (this.formationDraft.formation[slot] === studentId) this.formationDraft.formation[slot] = null;
      }
      this.render();
      return;
    }
  }

  async onKeyDown(event) {
    if (event.key === "Escape" && this.detailStudentId) {
      event.preventDefault();
      this.detailStudentId = null;
      this.render();
      return;
    }
    const input = event.target.closest("[data-name-input]");
    if (!input || event.key !== "Enter") return;
    event.preventDefault();
    try {
      await this.saveName(input.dataset.nameInput);
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  onDragStart(event) {
    if (event.target.closest("input, textarea, button, select")) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    const card = event.target.closest("[data-drag-student]");
    if (!card || this.route !== "roster") return;
    this.dragStudentId = card.dataset.dragStudent;
    card.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", this.dragStudentId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  onDragOver(event) {
    const target = event.target.closest("[data-drop-position]");
    if (!target || !this.dragStudentId || this.route !== "roster") return;
    event.preventDefault();
    target.classList.add("is-drop-target");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  onDragLeave(event) {
    const target = event.target.closest("[data-drop-position]");
    if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-drop-target");
  }

  onDrop(event) {
    const target = event.target.closest("[data-drop-position]");
    if (!target || !this.dragStudentId || this.route !== "roster") return;
    event.preventDefault();
    const targetSlot = target.dataset.dropPosition;
    const sourceSlot = POSITIONS.find((slot) => this.formationDraft.formation[slot] === this.dragStudentId);
    if (sourceSlot && targetSlot && sourceSlot !== targetSlot) {
      const targetStudent = this.formationDraft.formation[targetSlot];
      this.formationDraft.formation[targetSlot] = this.dragStudentId;
      this.formationDraft.formation[sourceSlot] = targetStudent ?? null;
      this.message = "站位已调整，保存后生效。";
    }
    this.dragStudentId = null;
    this.render();
  }

  onDragEnd(event) {
    event.target.closest("[data-drag-student]")?.classList.remove("is-dragging");
    this.root.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    this.dragStudentId = null;
  }

  async saveFormation() {
    if (!isValidFormation(this.formationDraft)) throw new Error("请安排 3 名不同学生到 A1、A2、A3 站位。");
    this.profile = await this.client.put("/profile", { version: this.profile.version, formation: this.formationDraft.formation });
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
    this.message = "编队已保存。";
  }

  async startBattle() {
    const formation = { ...this.profile.formation };
    const started = await this.client.post("/campaign/battles", {
      levelId: this.selectedLevelId,
      teamIds: POSITIONS.map((slot) => formation[slot]),
      formation,
    });
    this.battle = { ...started, settlement: null, playback: null, playbackState: null };
    try {
      const playback = createBattlePlayback(started.snapshot);
      if (playback) {
        this.battle.playback = playback;
        this.battle.playbackState = playback.getState();
        playback.subscribe((state) => {
          if (this.battle?.playback === playback) {
            this.battle.playbackState = state;
            this.render();
          }
        });
        playback.start();
      }
    } catch (error) {
      // Older test fixtures may return a minimal snapshot. Server settlement
      // remains available even when a local visual playback cannot be built.
      this.message = `快照已锁定，等待服务端回放（${error.message}）。`;
    }
    this.message = "战斗快照已由服务端创建。";
    this.navigate("battle");
  }

  async settleBattle() {
    this.battle?.playback?.pause();
    this.battle.settlement = await this.client.post(`/campaign/battles/${this.battle.id}/settle`);
    if (this.battle.settlement.profile) {
      this.profile = this.battle.settlement.profile;
      this.formationDraft = initialFormation(this.profile);
      this.rosterEditing = false;
    }
    this.message = "服务端结算已完成。";
  }

  async saveName(studentId) {
    const input = this.root.querySelector(`[data-name-input="${studentId}"]`);
    this.profile = await this.client.put("/profile", { version: this.profile.version, students: { [studentId]: { name: input?.value ?? "" } } });
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
    this.message = "学生名称已保存。";
  }

  async train() {
    const studentId = this.root.querySelector("#training-student").value;
    const ability = this.root.querySelector("#training-ability").value;
    const result = await this.client.post("/progression/training/specialist", { studentId, ability });
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
    this.message = "专项训练已完成。";
  }

  async buy(offerId) {
    const result = await this.client.post("/progression/shop/purchases", { offerId });
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
    this.message = "购买成功。";
  }

  async recruit() {
    const result = await this.client.post("/progression/recruitment", {});
    this.profile = result.profile;
    this.formationDraft = initialFormation(this.profile);
    this.rosterEditing = false;
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
