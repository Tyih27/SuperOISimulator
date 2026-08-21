import { ApiError } from "../api/client.js";
import { APTITUDE_ORDER } from "../data.js";
import { createAuthSession, renderAccountScreen, renderAuthScreen } from "./auth.js";
import { getLevel, renderCampaign } from "./campaign.js";
import { renderLineupDialog, renderProgression, renderRoster, renderStudentDetail } from "./progression.js";
import { renderArena } from "./arena.js";
import { createPlayback } from "./state.js";
import { EVENT_LABELS } from "./event-labels.js";

const ROUTES = new Set(["campaign", "roster", "progression", "account", "battle", "arena"]);
const POSITIONS = ["A1", "A2", "A3"];

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function messageFor(error) {
  if (error instanceof ApiError) {
    const labels = {
      REQUEST_TOO_FREQUENT: "操作过于频繁，请稍后再试。",
      PROFILE_VERSION_CONFLICT: "档案已更新，请刷新后重试。",
      DAILY_CHECK_IN_ALREADY_CLAIMED: "今日签到奖励已领取。",
      BATTLE_ALREADY_SETTLED: "这场战斗已经结算。",
      INVALID_PROGRESSION_REQUEST: "训练请求无效，请检查资源和选择。",
      INVALID_ARENA_REQUEST: "竞技场请求无效，请先保存防守编队。",
      ARENA_DAILY_LIMIT_REACHED: "今日竞技场对战次数已达上限（40 场），请明天再战。",
    };
    return labels[error.code] ?? error.message;
  }
  return "无法连接到训练服务，请检查服务是否已启动。";
}

function isErrorRateLimited(error) {
  return error instanceof ApiError && error.status === 429;
}

function isValidFormationMap(formation, students) {
  const placed = POSITIONS.map((slot) => formation?.[slot]).filter(Boolean);
  return placed.length <= POSITIONS.length
    && new Set(placed).size === placed.length
    && placed.every((studentId) => Boolean(students?.[studentId]));
}

function renderShell({ account, route, content }) {
  return `<a class="skip-link" href="#main-content">跳到主要内容</a><div class="account-shell"><header class="account-topbar"><a class="app-brand" href="#campaign">SUPER OI <span>SIMULATOR</span></a><nav aria-label="主导航"><a href="#campaign"${route === "campaign" ? " aria-current=\"page\"" : ""}>主线关卡</a><a href="#arena"${route === "arena" ? " aria-current=\"page\"" : ""}>异步竞技场</a><a href="#roster"${route === "roster" ? " aria-current=\"page\"" : ""}>学生名单</a><a href="#progression"${route === "progression" ? " aria-current=\"page\"" : ""}>训练与补给</a><a href="#account"${route === "account" ? " aria-current=\"page\"" : ""}>账户与数据</a></nav><div class="account-actions"><span>${esc(account.username)}</span><button class="icon-button" type="button" data-action="logout" aria-label="退出登录" title="退出登录">退出</button></div></header><div class="topbar-warning" role="alert"><span class="warning-icon" aria-hidden="true">!</span><p>当前处于删档测试阶段，正式确定后会删除已有存档。</p></div><main id="main-content" class="account-main">${content}</main></div>`;
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

function objectiveTargetFor(level) {
  if (!level?.objective) return 0;
  return level.objective.type === "all" ? level.topics?.length ?? 0 : level.objective.requiredTopics ?? 0;
}

function renderLiveBattle({ battle, state }) {
  if (!state?.combat) return "";
  const students = battle.snapshot.team;
  const studentNames = new Map(students.map((student) => [student.id, student.name]));
  const runtimeStudents = state.combat.state?.students ?? {};
  const runtimeProblems = state.combat.state?.problems ?? {};
  const activeSlots = state.combat.state?.activeProblems ?? {};
  const levelTopics = battle.snapshot.level.topics ?? [];
  const topicsById = new Map(levelTopics.map((topic) => [topic.id, topic]));
  const passedCount = levelTopics.filter(({ id }) => runtimeProblems[id]?.passed).length;
  const objectiveTarget = objectiveTargetFor(battle.snapshot.level);
  const events = state.combat.events ?? [];
  const isDone = state.phase === "result";
  return `<section class="live-battle panel" aria-labelledby="live-battle-title">
    <div class="panel-header"><div><p class="eyebrow">${isDone ? "战斗已结束" : "实时对战"}</p><h2 id="live-battle-title">${isDone ? "战斗结果已就绪" : "对战过程"}</h2></div><span class="panel-meta">${esc(state.phase)} · ${esc(state.stepCount)} 步</span></div>
    <div class="live-battle-toolbar"><span class="live-status" role="status" aria-live="polite">${esc(state.lastEvent ? `${EVENT_LABELS[state.lastEvent.type] ?? state.lastEvent.type}${state.lastEvent.round ? ` · 第 ${state.lastEvent.round} 回合` : ""}` : "准备中")}</span><div class="battle-controls"><button class="secondary-button" type="button" data-action="${state.playing ? "pause-live-battle" : "start-live-battle"}"${isDone ? " disabled" : ""}>${state.playing ? "暂停" : "播放"}</button><button class="secondary-button" type="button" data-action="step-live-battle"${isDone ? " disabled" : ""}>单步</button><button class="secondary-button" type="button" data-action="restart-live-battle">重播</button><span class="speed-control" aria-label="播放速度">${[0.5, 1, 2, 4].map((speed) => `<button class="speed-button${Number(state.speed) === speed ? " is-active" : ""}" type="button" data-playback-speed="${speed}">${speed}x</button>`).join("")}</span></div></div>
    <div class="live-battle-grid"><div><h3>我方队伍</h3><div class="live-student-list">${students.map((student) => {
      const runtime = runtimeStudents[student.id] ?? { energy: student.maxEnergy, focus: 0, alive: true };
      return `<article class="live-student ${runtime.alive ? "" : "is-inactive"}"><div class="student-card-head"><strong>${esc(student.name)}</strong><span class="alive-state">${runtime.alive ? "做题中" : "已退场"}</span></div><div class="stat-line"><span>精力</span><strong>${Math.round(runtime.energy)} / ${student.maxEnergy}</strong></div><div class="meter energy"><span style="width:${percent(runtime.energy, student.maxEnergy)}%"></span></div><div class="stat-line"><span>专注</span><strong>${Math.round(runtime.focus ?? 0)} / ${state.combat.state?.focusMax ?? 1000}</strong></div><div class="meter focus"><span style="width:${percent(runtime.focus, state.combat.state?.focusMax ?? 1000)}%"></span></div></article>`;
    }).join("")}</div></div><div><div class="panel-header"><h3>题目战线</h3><span class="panel-meta">已通过 ${passedCount} / 目标 ${objectiveTarget}</span></div><div class="live-topic-list">${["B1", "B2", "B3"].map((slot) => {
      const id = activeSlots[slot];
      const topic = id ? topicsById.get(id) : null;
      if (!topic) {
        return `<article class="live-topic is-idle"><div class="topic-name-row"><strong>待命</strong><span class="position-badge">${slot}</span></div><div class="topic-progress-label"><span>暂无更多题目</span><strong>—</strong></div></article>`;
      }
      const runtime = runtimeProblems[topic.id] ?? { progress: 0, maxProgress: topic.maxProgress ?? 10000, passed: false };
      return `<article class="live-topic ${runtime.passed ? "is-complete" : ""}"><div class="topic-name-row"><strong>${esc(topic.name)}</strong><span class="position-badge">${runtime.passed ? "✓" : slot}</span></div><div class="topic-progress-label"><span>${runtime.passed ? "已完成，即将换题" : "推进中"}</span><strong>${Math.round(percent(runtime.progress, runtime.maxProgress))}%</strong></div><div class="topic-progress"><span style="width:${percent(runtime.progress, runtime.maxProgress)}%"></span></div></article>`;
    }).join("")}</div></div></div>
    <details class="live-event-log" open><summary>事件记录（${events.length}）</summary><ol class="event-replay">${events.slice(-30).map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(EVENT_LABELS[event.type] ?? event.type)}${event.actor ? ` · ${esc(studentNames.get(event.actor) ?? "未知学生")}` : ""}</li>`).join("")}</ol></details>
  </section>`;
}

function renderBattle({ battle, message, messageIsError = false }) {
  const result = battle.settlement?.result;
  const reward = battle.settlement?.reward ?? {};
  const studentNames = new Map((battle.snapshot.team ?? []).map((student) => [student.id, student.name]));
  const liveState = battle.playbackState;
  return `<section class="app-view battle-replay" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">服务端战斗记录</p><h1 id="battle-title">${esc(battle.snapshot.level.name)}</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>战斗编号</span><strong class="mono">${esc(battle.id)}</strong></div><div><span>本局 seed</span><strong>${esc(battle.snapshot.seed)}</strong></div><div><span>队伍</span><strong>${battle.snapshot.team.map((student) => esc(student.name)).join(" / ")}</strong></div></div>${liveState ? renderLiveBattle({ battle, state: liveState }) : ""}${result ? `<section class="settled-result ${result.result === "win" ? "is-win" : "is-lose"}"><h2>${result.result === "win" ? "挑战胜利" : "挑战失败"}</h2><p>${result.result === "win" ? `获得 ${reward.trainingCoins ?? 0} 训练币。` : "本次未获得关卡奖励。"}</p><dl><div><dt>完成题目</dt><dd>${result.completedCount} / ${objectiveTargetFor(battle.snapshot.level)}</dd></div><div><dt>结束回合</dt><dd>${result.round}</dd></div><div><dt>剩余精力</dt><dd>${result.remainingEnergy}</dd></div></dl></section><section class="event-replay"><h2>服务端回放</h2><ol>${result.events.map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(EVENT_LABELS[event.type] ?? event.type)}${event.actor ? ` · ${esc(studentNames.get(event.actor) ?? "未知学生")}` : ""}</li>`).join("")}</ol></section>` : `<section class="battle-ready"><h2>快照已锁定</h2><p>队伍、关卡和本局 seed 已由服务端记录。结算与回放始终使用这份不可变快照。</p><button class="primary-button" type="button" data-action="settle-battle">开始回放并结算</button></section>`}</section>`;
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
    this.lineupOpen = false;
    this.lineupSaving = false;
    this.rosterSelectedId = null;
    this.enhanceOpen = false;
    this.replaceOpen = false;
    this.dismissOpen = false;
    this.dismissSelected = [];
    this.dismissConfirmPending = false;
    this.detailStudentId = null;
    this.detailNameEditing = false;
    this.dragStudentId = null;
    this.battle = null;
    this.arena = { defense: null, opponents: [], history: [], match: null, replay: null, battlesToday: null, dailyLimit: null };
    this.message = "";
    this.messageIsError = false;
    this.root.addEventListener("submit", (event) => this.onSubmit(event));
    this.root.addEventListener("click", (event) => this.onClick(event));
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
    this.messageIsError = isErrorRateLimited(error);
    this.render();
    }
  }

  async loadProfile() {
    this.profile = await this.client.get("/profile");
    if (this.detailStudentId && !this.profile.students?.[this.detailStudentId]) {
      this.detailStudentId = null;
      this.detailNameEditing = false;
    }
    this.selectedLevelId ??= this.profile.unlockedLevelIds[0];
  }

  applyHash() {
    if (!this.account) return;
    const candidate = globalThis.location?.hash?.slice(1) || "campaign";
    this.route = ROUTES.has(candidate) ? candidate : "campaign";
    if (this.route === "battle" && !this.battle) this.route = "campaign";
    if (this.route !== "roster") {
      this.lineupOpen = false;
      this.rosterSelectedId = null;
      this.enhanceOpen = false;
      this.replaceOpen = false;
      this.dismissOpen = false;
      this.dismissSelected = [];
      this.dismissConfirmPending = false;
      this.detailStudentId = null;
      this.detailNameEditing = false;
    }
    if (this.route === "arena" && this.arena.dailyLimit === null) this.refreshArenaQuota();
    this.render();
  }

  navigate(route) {
    if (route !== "battle") this.battle?.playback?.pause();
    if (globalThis.location) globalThis.location.hash = route;
    this.applyHash();
  }

  async refreshArenaQuota() {
    try {
      const data = await this.client.get("/arena/defense");
      this.arena.battlesToday = data.battlesToday ?? 0;
      this.arena.dailyLimit = data.dailyLimit ?? null;
      if (data.defense) this.arena.defense = data.defense;
    } catch (error) {
      this.message = messageFor(error);
    }
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
    if (this.route === "roster") content = renderRoster({ profile: this.profile, selectedId: this.rosterSelectedId, enhanceOpen: this.enhanceOpen, replaceOpen: this.replaceOpen, dismissOpen: this.dismissOpen, dismissSelected: this.dismissSelected, dismissConfirmPending: this.dismissConfirmPending, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "progression") content = renderProgression({ profile: this.profile, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "account") content = renderAccountScreen({ account: this.account, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "battle" && this.battle) content = renderBattle({ battle: this.battle, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "arena") content = renderArena({ profile: this.profile, ...this.arena, message: this.message, messageIsError: this.messageIsError });
    else content = renderCampaign({ profile: this.profile, selectedLevelId: this.selectedLevelId, message: this.message, messageIsError: this.messageIsError });
    const detailStudent = this.detailStudentId ? this.profile.students?.[this.detailStudentId] : null;
    const dismissible = Boolean(detailStudent
      && !Object.values(this.profile.formation ?? {}).includes(detailStudent.id));
    const lineupDialog = this.lineupOpen && this.route === "roster" ? renderLineupDialog({ profile: this.profile }) : "";
    this.root.innerHTML = renderShell({ account: this.account, route: this.route, content: `${content}${lineupDialog}${renderStudentDetail({ student: detailStudent, editingName: this.detailNameEditing, dismissible })}` });
    if (detailStudent) {
      const focusTarget = this.detailNameEditing
        ? this.root.querySelector("[data-name-input]")
        : this.root.querySelector("[data-student-detail-close]");
      focusTarget?.focus();
    }
  }

  async onSubmit(event) {
    const enhanceForm = event.target.closest("[data-enhance-form]");
    if (enhanceForm) {
      event.preventDefault();
      const ability = new FormData(enhanceForm).get("enhance-ability");
      try {
        await this.train(enhanceForm.dataset.studentId, ability);
      } catch (error) {
        this.message = messageFor(error);
      }
      this.render();
      return;
    }
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
      this.messageIsError = isErrorRateLimited(error);
      this.render();
    }
  }

  async onClick(event) {
    const overlay = event.target.closest("[data-student-detail-overlay]");
    if (overlay && event.target === overlay) {
      event.preventDefault();
      this.detailStudentId = null;
      this.detailNameEditing = false;
      this.render();
      return;
    }
    const lineupOverlay = event.target.closest("[data-lineup-overlay]");
    if (lineupOverlay && event.target === lineupOverlay) {
      event.preventDefault();
      this.lineupOpen = false;
      this.message = "";
      this.render();
      return;
    }
    const button = event.target.closest("button, a[data-action]");
    if (!button) return;
    if (button.matches("[data-student-detail]")) {
      event.preventDefault();
      event.stopPropagation();
      this.detailStudentId = button.dataset.studentDetail;
      this.detailNameEditing = false;
      this.render();
      return;
    }
    if (button.matches("[data-select-roster-student]")) {
      event.preventDefault();
      this.rosterSelectedId = button.dataset.selectRosterStudent;
      this.enhanceOpen = false;
      this.replaceOpen = false;
      this.message = "";
      this.render();
      return;
    }
    if (button.matches("[data-replace-with]")) {
      event.preventDefault();
      await this.replaceStarter(button.dataset.replaceTarget, button.dataset.replaceWith);
      return;
    }
    if (button.matches("[data-select-level]")) {
      this.selectedLevelId = button.dataset.selectLevel;
      this.message = "";
      this.render();
      return;
    }
    const action = button.dataset.action;
    if (!action && !button.dataset.opponentId && !button.dataset.buyOffer && !button.dataset.saveName && !button.dataset.dismissStudent && !button.dataset.benchStudent && !button.dataset.toggleDismiss && !button.dataset.toggleDismissAptitude && !button.dataset.playbackSpeed) return;
    event.preventDefault();
    try {
      if (action === "logout") {
        await this.auth.logout();
        this.account = null;
        this.profile = null;
        this.battle?.playback?.pause();
        this.battle = null;
        this.lineupOpen = false;
        this.rosterSelectedId = null;
        this.enhanceOpen = false;
        this.replaceOpen = false;
        this.detailStudentId = null;
        this.detailNameEditing = false;
        this.message = "已退出登录。";
      } else if (action === "close-student-detail") {
        this.detailStudentId = null;
        this.detailNameEditing = false;
        this.message = "";
      } else if (action === "edit-student-name") {
        this.detailNameEditing = true;
        this.message = "请输入新的学生名称。";
      } else if (action === "cancel-student-rename") {
        this.message = "已取消名称修改。";
        this.detailNameEditing = false;
      } else if (action === "open-lineup-editor") {
        this.lineupOpen = true;
        this.message = "拖拽卡片即可互换站位，修改即时保存。";
      } else if (action === "close-lineup-editor") {
        this.lineupOpen = false;
        this.message = "";
      } else if (action === "open-replace") {
        this.replaceOpen = true;
        this.enhanceOpen = false;
        this.message = "";
      } else if (action === "cancel-replace") {
        this.replaceOpen = false;
        this.message = "";
      } else if (action === "open-enhance") {
        this.enhanceOpen = true;
        this.message = "";
      } else if (action === "cancel-enhance") {
        this.enhanceOpen = false;
        this.message = "";
      } else if (action === "open-dismiss-panel") {
        this.dismissOpen = true;
        this.dismissSelected = [];
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (action === "close-dismiss-panel") {
        this.dismissOpen = false;
        this.dismissSelected = [];
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (action === "clear-dismiss-selection") {
        this.dismissSelected = [];
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (action === "toggle-dismiss-all") {
        const teamIds = new Set(Object.values(this.profile.formation ?? {}).filter(Boolean));
        const benchIds = Object.values(this.profile.students ?? {})
          .filter((student) => !teamIds.has(student.id))
          .map((student) => student.id);
        const allSelected = benchIds.length > 0 && benchIds.every((id) => this.dismissSelected.includes(id));
        this.dismissSelected = allSelected ? [] : benchIds;
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (action === "confirm-dismiss-selected") {
        if (!this.dismissSelected.length) {
          this.message = "请先勾选要劝退的替补学生。";
        } else {
          const rareCount = this.dismissSelected
            .map((id) => this.profile.students?.[id]?.aptitude)
            .filter((aptitude) => aptitude && APTITUDE_ORDER.indexOf(aptitude) >= APTITUDE_ORDER.indexOf("稀有"))
            .length;
          if (rareCount > 0 && !this.dismissConfirmPending) {
            this.dismissConfirmPending = true;
            this.messageIsError = true;
            this.message = `所选学生中包含 ${rareCount} 名稀有及以上资质学生，请再次点击「确认劝退」完成批量劝退。`;
          } else {
            await this.dismissSelectedStudents();
          }
        }
      } else if (button.dataset.toggleDismiss) {
        const studentId = button.dataset.toggleDismiss;
        this.dismissSelected = this.dismissSelected.includes(studentId)
          ? this.dismissSelected.filter((id) => id !== studentId)
          : [...this.dismissSelected, studentId];
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (button.dataset.toggleDismissAptitude) {
        const aptitude = button.dataset.toggleDismissAptitude;
        const teamIds = new Set(Object.values(this.profile.formation ?? {}).filter(Boolean));
        const aptitudeIds = Object.values(this.profile.students ?? {})
          .filter((student) => !teamIds.has(student.id) && student.aptitude === aptitude)
          .map((student) => student.id);
        const allSelected = aptitudeIds.every((id) => this.dismissSelected.includes(id));
        this.dismissSelected = allSelected
          ? this.dismissSelected.filter((id) => !aptitudeIds.includes(id))
          : [...new Set([...this.dismissSelected, ...aptitudeIds])];
        this.dismissConfirmPending = false;
        this.message = "";
      } else if (action === "use-energy-tonic") {
        await this.useEnergyTonic(button.dataset.studentId);
      } else if (action === "daily-check-in") {
        await this.dailyCheckIn();
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
      } else if (button.dataset.playbackSpeed) {
        this.battle?.playback?.setSpeed(button.dataset.playbackSpeed);
        this.message = `播放速度已调整为 ${button.dataset.playbackSpeed}x。`;
      } else if (action === "load-arena-opponents") {
        this.arena.opponents = await this.client.get("/arena/opponents");
        await this.refreshArenaQuota();
        this.message = "对手列表已刷新。";
      } else if (action === "load-arena-history") {
        this.arena.history = await this.client.get("/arena/matches?limit=20");
        this.message = "比赛历史已刷新。";
      } else if (action === "save-arena-defense") {
        const teamIds = POSITIONS.map((slot) => this.profile.formation[slot]).filter(Boolean);
        if (!teamIds.length) {
          this.message = "请先在学生名单安排至少一名上场学生，再保存防守编队。";
        } else {
          const saved = await this.client.put("/arena/defense", { version: this.profile.version, teamIds, formation: this.profile.formation });
          this.arena.defense = saved.defense;
          this.message = "防守编队已锁定。";
        }
      } else if (action === "settle-arena") {
        this.arena.replay = await this.client.post(`/arena/matches/${this.arena.match.id}/settle`, {});
        this.profile = this.arena.replay.profile ?? await this.client.get("/profile");
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
        if (this.arena.dailyLimit !== null) this.arena.battlesToday = Math.min((this.arena.battlesToday ?? 0) + 1, this.arena.dailyLimit);
        this.message = "比赛快照已锁定。";
      } else if (button.dataset.buyOffer) {
        await this.buy(button.dataset.buyOffer);
      } else if (button.dataset.dismissStudent) {
        await this.dismissStudent(button.dataset.dismissStudent);
      } else if (button.dataset.benchStudent) {
        const formation = { ...this.profile.formation };
        const slot = POSITIONS.find((position) => formation[position] === button.dataset.benchStudent);
        if (slot) {
          formation[slot] = null;
          try {
            await this.applyFormation(formation);
          } catch (error) {
            this.message = messageFor(error);
          }
        }
      } else if (button.dataset.saveName) {
        await this.saveName(button.dataset.saveName);
      }
    } catch (error) {
      this.message = messageFor(error);
      this.messageIsError = isErrorRateLimited(error);
    }
    this.render();
  }

  async onKeyDown(event) {
    if (event.key === "Escape") {
      if (this.detailStudentId) {
        event.preventDefault();
        if (this.detailNameEditing) {
          this.detailNameEditing = false;
        } else {
          this.detailStudentId = null;
        }
        this.render();
        return;
      }
      if (this.lineupOpen) {
        event.preventDefault();
        this.lineupOpen = false;
        this.render();
      }
      return;
    }
    const input = event.target.closest("[data-name-input]");
    if (!input || event.key !== "Enter") return;
    event.preventDefault();
    try {
      await this.saveName(input.dataset.nameInput);
    } catch (error) {
      this.message = messageFor(error);
      this.messageIsError = isErrorRateLimited(error);
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
    if (!card || !this.lineupOpen || this.route !== "roster" || this.lineupSaving) return;
    this.dragStudentId = card.dataset.dragStudent;
    card.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", this.dragStudentId);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  onDragOver(event) {
    const target = event.target.closest("[data-drop-position]");
    if (!target || !this.dragStudentId || !this.lineupOpen || this.lineupSaving) return;
    event.preventDefault();
    target.classList.add("is-drop-target");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  }

  onDragLeave(event) {
    const target = event.target.closest("[data-drop-position]");
    if (target && !target.contains(event.relatedTarget)) target.classList.remove("is-drop-target");
  }

  async onDrop(event) {
    const target = event.target.closest("[data-drop-position]");
    if (!target || !this.dragStudentId || !this.lineupOpen || this.lineupSaving) return;
    event.preventDefault();
    const targetSlot = target.dataset.dropPosition;
    const draggedId = this.dragStudentId;
    this.dragStudentId = null;
    const formation = { ...this.profile.formation };
    const sourceSlot = POSITIONS.find((slot) => formation[slot] === draggedId);
    if (!targetSlot || !this.profile.students?.[draggedId] || sourceSlot === targetSlot) {
      this.render();
      return;
    }
    const displaced = formation[targetSlot] ?? null;
    formation[targetSlot] = draggedId;
    if (sourceSlot) formation[sourceSlot] = displaced;
    try {
      await this.applyFormation(formation);
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  onDragEnd(event) {
    event.target.closest("[data-drag-student]")?.classList.remove("is-dragging");
    this.root.querySelectorAll(".is-drop-target").forEach((node) => node.classList.remove("is-drop-target"));
    this.dragStudentId = null;
  }

  async applyFormation(formation) {
    if (!isValidFormationMap(formation, this.profile.students)) throw new Error("编队学生必须是名单中未重复的学生。");
    this.lineupSaving = true;
    try {
      this.profile = await this.client.put("/profile", { version: this.profile.version, formation });
      this.message = "阵容已调整。";
      this.rosterSelectedId = null;
    } finally {
      this.lineupSaving = false;
    }
  }

  async replaceStarter(outgoingId, incomingId) {
    const formation = { ...this.profile.formation };
    const slot = POSITIONS.find((position) => formation[position] === outgoingId);
    const incoming = this.profile.students?.[incomingId];
    if (!slot || !incoming || Object.values(formation).includes(incomingId)) {
      this.message = "无法完成替换，请刷新后重试。";
      this.render();
      return;
    }
    formation[slot] = incomingId;
    try {
      await this.applyFormation(formation);
      this.replaceOpen = false;
      this.message = `${incoming.name} 已替换上场。`;
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  async startBattle() {
    const formation = { ...this.profile.formation };
    const teamIds = POSITIONS.map((slot) => formation[slot]).filter(Boolean);
    if (!teamIds.length) {
      this.message = "请先在学生名单安排至少一名上场学生。";
      return;
    }
    const started = await this.client.post("/campaign/battles", {
      levelId: this.selectedLevelId,
      teamIds,
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
      this.navigate("battle");
      return;
    }
    this.message = "战斗快照已由服务端创建。";
    this.navigate("battle");
  }

  async settleBattle() {
    this.battle?.playback?.pause();
    this.battle.settlement = await this.client.post(`/campaign/battles/${this.battle.id}/settle`);
    if (this.battle.settlement.profile) {
      this.profile = this.battle.settlement.profile;
    }
    this.message = "服务端结算已完成。";
  }

  async saveName(studentId) {
    const input = this.root.querySelector(`[data-name-input="${studentId}"]`);
    this.profile = await this.client.put("/profile", { version: this.profile.version, students: { [studentId]: { name: input?.value ?? "" } } });
    this.detailNameEditing = false;
    this.message = "学生名称已保存。";
  }

  async train(studentId, ability) {
    if (!studentId || !ability) throw new Error("请选择要提升的能力。");
    const result = await this.client.post("/progression/training/specialist", { studentId, ability });
    this.profile = result.profile;
    this.enhanceOpen = true;
    const training = result.training;
    this.message = !training
      ? "学生强化完成。"
      : training.itemId === "student-training-material"
        ? `学生强化完成，数值 ${training.previousValue} → ${training.currentValue}，已消耗 1 份学生培养材料和 100 训练币。`
        : `学生强化完成，数值 ${training.previousValue} → ${training.currentValue}，已消耗对应训练册。`;
  }

  async dailyCheckIn() {
    const result = await this.client.post("/progression/daily-check-in", {});
    this.profile = result.profile;
    this.message = `签到成功，获得 ${result.reward?.trainingCoins ?? 1000} 训练币。`;
  }

  async buy(offerId) {
    const result = await this.client.post("/progression/shop/purchases", { offerId });
    this.profile = result.profile;
    this.message = "购买成功。";
  }

  async dismissStudent(studentId) {
    const result = await this.client.post(`/progression/students/${encodeURIComponent(studentId)}/dismiss`, {});
    this.profile = result.profile;
    this.detailStudentId = null;
    this.detailNameEditing = false;
    this.message = "学生已劝退，获得 1 份学生培养材料。";
  }

  async dismissSelectedStudents() {
    const studentIds = [...this.dismissSelected];
    const result = await this.client.post("/progression/students/dismiss-batch", { studentIds });
    this.profile = result.profile;
    const count = result.dismissal?.studentIds?.length ?? studentIds.length;
    const quantity = result.dismissal?.quantity ?? count;
    this.dismissOpen = false;
    this.dismissSelected = [];
    this.dismissConfirmPending = false;
    this.messageIsError = false;
    this.message = `已劝退 ${count} 名学生，共获得 ${quantity} 份学生培养材料。`;
  }

  async useEnergyTonic(studentId) {
    if (!studentId) throw new Error("请先选择要使用精力药剂的学生。");
    const result = await this.client.post(`/progression/students/${encodeURIComponent(studentId)}/energy`, {});
    this.profile = result.profile;
    const energy = result.energy;
    this.message = energy
      ? `精力上限已提升：${energy.previousValue} → ${energy.currentValue}，已消耗 1 份精力药剂。`
      : "精力上限已提升。";
  }

  async recruit() {
    const result = await this.client.post("/progression/recruitment", {});
    this.profile = result.profile;
    const aptitude = result.student?.aptitude;
    const pity = Number.isInteger(result.recruitment?.attemptsSinceGenius)
      ? result.recruitment.attemptsSinceGenius
      : this.profile.recruitment?.attemptsSinceGenius;
    this.message = aptitude
      ? `已招募一名${aptitude}学生${pity === 0 ? "，天才保底已重置。" : `，天才保底进度 ${pity} / 30。`}`
      : "已招募一名新学生。";
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
        if (values.confirmed !== "on") throw new Error("请确认删除账户。");
        await this.client.delete("/account", { password: values.password });
        this.account = null;
        this.profile = null;
        this.battle = null;
        this.message = "账号已删除，所有相关数据已一并清除。";
      }
    } catch (error) {
      this.message = messageFor(error);
      this.messageIsError = isErrorRateLimited(error);
    }
    this.render();
  }
}

export function createRouter(options) {
  return new AppRouter(options);
}
