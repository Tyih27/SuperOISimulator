import { ApiError } from "../api/client.js";
import { APTITUDE_ORDER } from "../data.js";
import { SPECIALIST_TRAINING_INCREMENTS } from "../domain/progression.js";
import { BOSS_MAX_ROUNDS } from "../combat/boss-content.js";
import { createAuthSession, renderAccountScreen, renderAuthScreen } from "./auth.js";
import { getLevel, renderCampaign } from "./campaign.js";
import { renderLineupDialog, renderProgression, renderRoster, renderStudentDetail, refundSummaryText } from "./progression.js";
import { renderModes } from "./modes.js";
import { createPlayback } from "./state.js";
import { EVENT_LABELS } from "./event-labels.js";

const ROUTES = new Set(["campaign", "roster", "progression", "account", "battle", "arena", "modes"]);
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
      INVALID_BOSS_REQUEST: "BOSS战请求无效，请检查上场编队。",
      BOSS_DAILY_LIMIT_REACHED: "今日 BOSS 挑战次数已达上限（10 次），请明天再来。",
      ADMIN_REQUIRED: "只有管理员可以查看反馈列表。",
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
  return `<a class="skip-link" href="#main-content">跳到主要内容</a><div class="account-shell"><header class="account-topbar"><a class="app-brand" href="#campaign">SUPER OI <span>SIMULATOR</span></a><nav aria-label="主导航"><a href="#campaign"${route === "campaign" ? " aria-current=\"page\"" : ""}>主线关卡</a><a href="#modes"${route === "modes" ? " aria-current=\"page\"" : ""}>玩法</a><a href="#roster"${route === "roster" ? " aria-current=\"page\"" : ""}>学生名单</a><a href="#progression"${route === "progression" ? " aria-current=\"page\"" : ""}>训练与补给</a><a href="#account"${route === "account" ? " aria-current=\"page\"" : ""}>账户与数据</a></nav><div class="account-actions"><span>${esc(account.username)}</span><button class="icon-button" type="button" data-action="logout" aria-label="退出登录" title="退出登录">退出</button></div></header><div class="topbar-warning" role="alert"><span class="warning-icon" aria-hidden="true">!</span><p>当前处于删档测试阶段，正式确定后会删除已有存档。</p></div><main id="main-content" class="account-main">${content}</main></div>`;
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
  const runtimeStudents = state.combat.state?.students ?? {};
  const runtimeProblems = state.combat.state?.problems ?? {};
  const levelTopics = battle.snapshot.level.topics ?? [];
  const topicsById = new Map(levelTopics.map((topic) => [topic.id, topic]));
  const activeProblems = Object.entries(state.combat.state?.activeProblems ?? {})
    .map(([slot, id]) => ({ slot, runtime: id ? runtimeProblems[id] : null, topic: id ? topicsById.get(id) : null }))
    .filter(({ runtime, topic }) => topic);
  const passedCount = levelTopics.filter(({ id }) => runtimeProblems[id]?.passed).length;
  const objectiveTarget = objectiveTargetFor(battle.snapshot.level);
  const isDone = state.phase === "result";
  return `<section class="live-battle panel" aria-labelledby="live-battle-title">
    <div class="panel-header"><div><p class="eyebrow">${isDone ? "战斗已结束" : "实时对战"}</p><h2 id="live-battle-title">${isDone ? "战斗结果已就绪" : "对战过程"}</h2></div><span class="panel-meta">${esc(state.phase)} · ${esc(state.stepCount)} 步</span></div>
    <div class="live-battle-toolbar"><span class="live-status" role="status" aria-live="polite">${esc(state.lastEvent ? `${EVENT_LABELS[state.lastEvent.type] ?? state.lastEvent.type}${state.lastEvent.round ? ` · 第 ${state.lastEvent.round} 回合` : ""}` : "准备中")}</span><div class="battle-controls"><button class="secondary-button" type="button" data-action="${state.playing ? "pause-live-battle" : "start-live-battle"}"${isDone ? " disabled" : ""}>${state.playing ? "暂停" : "播放"}</button><button class="secondary-button" type="button" data-action="step-live-battle"${isDone ? " disabled" : ""}>单步</button><button class="secondary-button" type="button" data-action="restart-live-battle">重播</button><button class="secondary-button" type="button" data-action="skip-live-battle"${isDone ? " disabled" : ""}>跳过</button><span class="speed-control" aria-label="播放速度">${[0.5, 1, 2, 4].map((speed) => `<button class="speed-button${Number(state.speed) === speed ? " is-active" : ""}" type="button" data-playback-speed="${speed}">${speed}x</button>`).join("")}</span></div></div>
    <div class="live-battle-grid"><div><h3>我方队伍</h3><div class="live-student-list">${students.map((student) => {
      const runtime = runtimeStudents[student.id] ?? { energy: student.maxEnergy, focus: 0, alive: true };
      return `<article class="live-student ${runtime.alive ? "" : "is-inactive"}"><div class="student-card-head"><strong>${esc(student.name)}</strong><span class="alive-state">${runtime.alive ? "做题中" : "已退场"}</span></div><div class="stat-line"><span>精力</span><strong>${Math.round(runtime.energy)} / ${student.maxEnergy}</strong></div><div class="meter energy"><span style="width:${percent(runtime.energy, student.maxEnergy)}%"></span></div><div class="stat-line"><span>专注</span><strong>${Math.round(runtime.focus ?? 0)} / ${state.combat.state?.focusMax ?? 1000}</strong></div><div class="meter focus"><span style="width:${percent(runtime.focus, state.combat.state?.focusMax ?? 1000)}%"></span></div></article>`;
    }).join("")}</div></div><div><div class="panel-header"><h3>题目战线</h3><span class="panel-meta">已通过 ${passedCount} / 目标 ${objectiveTarget}</span></div><div class="live-topic-list">${activeProblems.map(({ slot, runtime, topic }) => `<article class="live-topic ${runtime?.passed ? "is-complete" : ""}"><div class="topic-name-row"><strong>${esc(topic.name)}</strong><span class="position-badge">${slot}</span></div><div class="topic-progress-label"><span>${runtime?.passed ? "已完成" : "推进度"}</span><strong>${Math.round(percent(runtime?.progress ?? 0, topic.maxProgress ?? 10000))}%</strong></div><div class="topic-progress"><span style="width:${percent(runtime?.progress ?? 0, topic.maxProgress ?? 10000)}%"></span></div></article>`).join("") || `<p class="empty-state">等待题目进入战线。</p>`}</div></div></div>
  </section>`;
}

function renderArenaSide({ label, snapshot, state }) {
  if (!snapshot?.team?.length || !snapshot.level) {
    return `<section class="arena-side arena-side--empty"><div class="panel-header"><h3>${esc(label)}</h3></div><p class="empty-state">等待该方战斗快照。</p></section>`;
  }
  const runtime = state?.combat ?? {};
  const runtimeStudents = runtime.state?.students ?? {};
  const runtimeProblems = runtime.state?.problems ?? {};
  const topics = snapshot.level.topics ?? [];
  const topicsById = new Map(topics.map((topic) => [topic.id, topic]));
  const activeProblems = Object.entries(runtime.state?.activeProblems ?? {})
    .map(([slot, id]) => ({ slot, runtime: id ? runtimeProblems[id] : null, topic: id ? topicsById.get(id) : null }))
    .filter(({ topic }) => topic);
  const passedCount = topics.filter(({ id }) => runtimeProblems[id]?.passed).length;
  const objectiveTarget = objectiveTargetFor(snapshot.level);
  const students = snapshot.team;
  const focusMax = runtime.state?.focusMax ?? snapshot.level.focusMax ?? 1000;
  const phase = state?.phase ?? "ready";
  return `<section class="arena-side" aria-label="${esc(label)}"><div class="panel-header"><div><p class="eyebrow">${esc(label)}</p><h3>${phase === "result" ? "本方结果" : "做题队伍"}</h3></div><span class="panel-meta">${esc(phase)} · ${esc(state?.stepCount ?? 0)} 步</span></div><div class="arena-side-grid"><div class="live-student-list">${students.map((student) => {
    const studentRuntime = runtimeStudents[student.id] ?? { energy: student.maxEnergy, focus: 0, alive: true };
    return `<article class="live-student ${studentRuntime.alive ? "" : "is-inactive"}"><div class="student-card-head"><strong>${esc(student.name)}</strong><span class="alive-state">${studentRuntime.alive ? "做题中" : "已退场"}</span></div><div class="stat-line"><span>精力</span><strong>${Math.round(studentRuntime.energy ?? student.maxEnergy)} / ${student.maxEnergy}</strong></div><div class="meter energy"><span style="width:${percent(studentRuntime.energy ?? student.maxEnergy, student.maxEnergy)}%"></span></div><div class="stat-line"><span>专注</span><strong>${Math.round(studentRuntime.focus ?? 0)} / ${focusMax}</strong></div><div class="meter focus"><span style="width:${percent(studentRuntime.focus, focusMax)}%"></span></div></article>`;
  }).join("")}</div><div><div class="panel-header"><h4>题目战线</h4><span class="panel-meta">已通过 ${passedCount} / 目标 ${objectiveTarget}</span></div><div class="live-topic-list">${activeProblems.map(({ slot, runtime: problemRuntime, topic }) => { const difficulty = Object.values(topic.difficulties ?? {}).reduce((sum, value) => sum + Number(value || 0), 0); return `<article class="live-topic ${problemRuntime?.passed ? "is-complete" : ""}"><div class="topic-name-row"><strong>${esc(topic.name)}</strong><span class="position-badge">${slot}</span></div><div class="topic-progress-label"><span>${problemRuntime?.passed ? "已完成" : "推进度"} · 难度 ${difficulty}</span><strong>${Math.round(percent(problemRuntime?.progress ?? 0, topic.maxProgress ?? 10000))}%</strong></div><div class="topic-progress"><span style="width:${percent(problemRuntime?.progress ?? 0, topic.maxProgress ?? 10000)}%"></span></div></article>`; }).join("") || `<p class="empty-state">等待题目进入战线。</p>`}</div></div></div></section>`;
}

function renderArenaLiveBattle({ battle }) {
  const snapshots = battle.snapshots ?? {};
  const states = battle.playbackStates ?? {};
  const attackerState = states.attacker;
  const defenderState = states.defender;
  if (!attackerState && !defenderState) return "";
  const playing = Boolean(attackerState?.playing || defenderState?.playing);
  const complete = Boolean(attackerState && defenderState && attackerState.phase === "result" && defenderState.phase === "result");
  const statusState = attackerState ?? defenderState;
  const lastEvent = statusState?.lastEvent;
  return `<section class="live-battle arena-live-battle" aria-labelledby="arena-live-battle-title"><div class="panel-header"><div><p class="eyebrow">${complete ? "战斗已结束" : "实时竞技场"}</p><h2 id="arena-live-battle-title">双方做题进度</h2></div><span class="panel-meta">${esc(statusState?.phase ?? "ready")} · ${esc(statusState?.stepCount ?? 0)} 步</span></div><div class="live-battle-toolbar"><span class="live-status" role="status" aria-live="polite">${esc(lastEvent ? `${EVENT_LABELS[lastEvent.type] ?? lastEvent.type}${lastEvent.round ? ` · 第 ${lastEvent.round} 回合` : ""}` : "准备中")}</span><div class="battle-controls"><button class="secondary-button" type="button" data-action="${playing ? "pause-live-battle" : "start-live-battle"}"${complete ? " disabled" : ""}>${playing ? "暂停" : "播放"}</button><button class="secondary-button" type="button" data-action="step-live-battle"${complete ? " disabled" : ""}>单步</button><button class="secondary-button" type="button" data-action="restart-live-battle">重播</button><button class="secondary-button" type="button" data-action="skip-live-battle"${complete ? " disabled" : ""}>跳过</button><span class="speed-control" aria-label="播放速度">${[0.5, 1, 2, 4].map((speed) => `<button class="speed-button${Number(statusState?.speed) === speed ? " is-active" : ""}" type="button" data-playback-speed="${speed}">${speed}x</button>`).join("")}</span></div></div><div class="arena-live-grid">${renderArenaSide({ label: "进攻方", snapshot: snapshots.attacker, state: attackerState })}${renderArenaSide({ label: "防守方", snapshot: snapshots.defender, state: defenderState })}</div></section>`;
}

function renderSettlementResult({ battle }) {
  const settlement = battle.settlement;
  if (!settlement?.result) return "";
  if (battle.mode === "boss") {
    const coins = settlement.reward?.trainingCoins ?? 0;
    return `<section class="settled-result ${coins > 0 ? "is-win" : "is-draw"}"><h2>战斗结束</h2><p>对 BOSS 造成 <strong>${settlement.damage ?? 0}</strong> 点伤害。${coins > 0 ? `获得 ${coins} 训练币。` : "本次未获得训练币。"}</p><dl><div><dt>坚持回合</dt><dd>${settlement.round ?? "-"} / ${BOSS_MAX_ROUNDS}</dd></div><div><dt>剩余精力</dt><dd>${settlement.remainingEnergy ?? "-"}</dd></div></dl></section>`;
  }
  if (battle.mode === "arena") {
    const snapshots = battle.snapshots ?? {};
    const attacker = snapshots.attacker ?? {};
    const defender = snapshots.defender ?? {};
    const result = settlement.result;
    const winnerText = result.winner === "attacker" ? "挑战胜利" : result.winner === "defender" ? "挑战失败" : result.winner === "draw" ? "平局" : "";
    const resultClass = result.winner === "attacker" ? "is-win" : result.winner === "draw" ? "is-draw" : "is-lose";
    return `<section class="settled-result ${resultClass}"><h2>${winnerText}</h2><p>${result.winner === "attacker" ? `获得 ${settlement.reward?.trainingCoins ?? 0} 训练币。` : "本次未获得竞技场奖励。"}</p><dl><div><dt>进攻方完成题目</dt><dd>${result.attacker?.completedCount ?? 0} / ${objectiveTargetFor(attacker.level)}</dd></div><div><dt>防守方完成题目</dt><dd>${result.defender?.completedCount ?? 0} / ${objectiveTargetFor(defender.level)}</dd></div><div><dt>积分</dt><dd>${settlement.rating?.attackerBefore ?? "-"} → ${settlement.rating?.attackerAfter ?? "-"}</dd></div></dl></section>`;
  }
  const result = settlement.result;
  const reward = settlement.reward ?? {};
  return `<section class="settled-result ${result.result === "win" ? "is-win" : "is-lose"}"><h2>${result.result === "win" ? "挑战胜利" : "挑战失败"}</h2><p>${result.result === "win" ? `获得 ${reward.trainingCoins ?? 0} 训练币。` : "本次未获得关卡奖励。"}</p><dl><div><dt>完成题目</dt><dd>${result.completedCount} / ${objectiveTargetFor(battle.snapshot.level)}</dd></div><div><dt>结束回合</dt><dd>${result.round}</dd></div><div><dt>剩余精力</dt><dd>${result.remainingEnergy}</dd></div></dl></section>`;
}

function renderSettlementDialog({ battle }) {
  if (!battle.settlement || !battle.resultDialogOpen) return "";
  return `<div class="battle-result-overlay" data-battle-result-overlay><section class="battle-result-dialog" role="dialog" aria-modal="true" aria-labelledby="battle-result-title"><div class="battle-result-header"><div><p class="eyebrow">对战结算</p><h2 id="battle-result-title">本局结果</h2></div><button class="icon-button" type="button" data-action="close-battle-result" aria-label="关闭对战结果" title="关闭对战结果">关闭</button></div>${renderSettlementResult({ battle })}<div class="battle-result-actions"><button class="primary-button" type="button" data-action="close-battle-result">知道了</button></div></section></div>`;
}

function renderSettlementRetry({ battle }) {
  if (!battle.settlementError || battle.settlement) return "";
  const retryAction = battle.mode === "arena" ? "settle-arena" : battle.mode === "boss" ? "settle-boss-challenge" : "settle-battle";
  return `<div class="settlement-retry" role="alert"><p>${esc(battle.settlementError)}</p><button class="secondary-button" type="button" data-action="${retryAction}">重试结算</button></div>`;
}

function renderBossBattle({ battle, message, messageIsError = false }) {
  const snapshot = battle.snapshot ?? {};
  const result = battle.settlement?.result;
  const liveState = battle.playbackState;
  return `<section class="app-view battle-replay boss-battle-page" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">BOSS战</p><h1 id="battle-title">${esc(snapshot.level?.name ?? "BOSS挑战")}</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>队伍</span><strong>${(snapshot.team ?? []).map((student) => esc(student.name)).join(" / ") || "等待快照"}</strong></div></div>${liveState ? renderLiveBattle({ battle: { snapshot }, state: liveState }) : ""}${result ? renderSettlementResult({ battle }) : ""}${renderSettlementRetry({ battle })}${renderSettlementDialog({ battle })}</section>`;
}

function renderArenaBattle({ battle, message, messageIsError = false }) {
  const snapshots = battle.snapshots ?? {};
  const attacker = snapshots.attacker ?? {};
  const defender = snapshots.defender ?? {};
  const result = battle.settlement?.result;
  return `<section class="app-view battle-replay arena-battle-page" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">竞技场对战</p><h1 id="battle-title">${esc(attacker.level?.name ?? "随机竞技场")}</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>进攻方</span><strong>${(attacker.team ?? []).map((student) => esc(student.name)).join(" / ") || "等待快照"}</strong></div><div><span>防守方</span><strong>${(defender.team ?? []).map((student) => esc(student.name)).join(" / ") || "等待快照"}</strong></div></div>${battle.quotaText ? `<p class="arena-quota-note">${esc(battle.quotaText)}</p>` : ""}${renderArenaLiveBattle({ battle })}${result ? renderSettlementResult({ battle }) : ""}${renderSettlementRetry({ battle })}${renderSettlementDialog({ battle })}</section>`;
}

function renderBattle({ battle, message, messageIsError = false }) {
  if (battle.mode === "arena") return renderArenaBattle({ battle, message, messageIsError });
  if (battle.mode === "boss") return renderBossBattle({ battle, message, messageIsError });
  const result = battle.settlement?.result;
  const liveState = battle.playbackState;
  return `<section class="app-view battle-replay" aria-labelledby="battle-title"><div class="view-heading"><div><p class="eyebrow">服务端战斗记录</p><h1 id="battle-title">${esc(battle.snapshot.level.name)}</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><div class="battle-summary"><div><span>队伍</span><strong>${battle.snapshot.team.map((student) => esc(student.name)).join(" / ")}</strong></div></div>${liveState ? renderLiveBattle({ battle, state: liveState }) : ""}${result ? renderSettlementResult({ battle }) : ""}${renderSettlementRetry({ battle })}${renderSettlementDialog({ battle })}</section>`;
}

export class AppRouter {
  constructor({ root, client }) {
    if (!root) throw new Error("AppRouter requires a root element");
    this.root = root;
    this.client = client;
    this.auth = createAuthSession(client);
    this.account = null;
    this.profile = null;
    this.feedback = null;
    this.feedbackLoading = false;
    this.route = "campaign";
    this.selectedLevelId = null;
    this.lineupOpen = false;
    this.lineupSaving = false;
    this.rosterSelectedId = null;
    this.fillSlotId = null;
    this.enhanceOpen = false;
    this.replaceOpen = false;
    this.dismissOpen = false;
    this.dismissSelected = [];
    this.dismissConfirmPending = false;
    this.detailStudentId = null;
    this.detailNameEditing = false;
    this.dragStudentId = null;
    this.battle = null;
    this.arena = { defense: null, defenseSnapshot: null, opponents: [], history: [], match: null, replay: null, battlesToday: null, dailyLimit: null };
    this.boss = { battlesToday: null, dailyLimit: null, history: [], match: null };
    this.modes = { tab: "arena" };
    this.message = "";
    this.messageIsError = false;
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
    const candidate = globalThis.location?.hash?.slice(1) || "";
    if (candidate === "arena") this.modes.tab = "arena";
    let nextRoute;
    if (candidate === "modes" || candidate === "arena") nextRoute = "modes";
    else if (ROUTES.has(candidate)) nextRoute = candidate;
    else if (!candidate) nextRoute = "campaign";
    else return;
    this.route = nextRoute;
    if (this.route === "battle" && !this.battle) this.route = "campaign";
    if (this.route !== "roster") {
      this.lineupOpen = false;
      this.rosterSelectedId = null;
      this.fillSlotId = null;
      this.enhanceOpen = false;
      this.replaceOpen = false;
      this.dismissOpen = false;
      this.dismissSelected = [];
      this.dismissConfirmPending = false;
      this.detailStudentId = null;
      this.detailNameEditing = false;
    }
    if (this.route === "modes" && this.modes.tab === "arena") this.refreshArenaQuota();
    if (this.route === "modes" && this.modes.tab === "boss-rush" && this.boss.dailyLimit === null) this.refreshBossQuota();
    if (this.route === "account" && this.account.role === "admin" && this.feedback === null) this.refreshFeedback();
    this.render();
  }

  navigate(route) {
    if (this.route === "battle" && route !== "battle") this.activePlaybacks().forEach((playback) => playback.pause());
    if (globalThis.location) globalThis.location.hash = route;
    this.applyHash();
  }

  activePlaybacks() {
    if (this.battle?.mode === "arena") return Object.values(this.battle.playbacks ?? {}).filter(Boolean);
    return this.battle?.playback ? [this.battle.playback] : [];
  }

  async refreshArenaQuota() {
    try {
      const data = await this.client.get("/arena/defense");
      this.arena.battlesToday = data.battlesToday ?? 0;
      this.arena.dailyLimit = data.dailyLimit ?? null;
      this.arena.defense = data.defense ?? null;
      this.arena.defenseSnapshot = data.snapshot ?? null;
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  async refreshBossQuota() {
    try {
      const data = await this.client.get("/boss/quota");
      this.boss.battlesToday = data.battlesToday ?? 0;
      this.boss.dailyLimit = data.dailyLimit ?? null;
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
  }

  async refreshFeedback() {
    this.feedbackLoading = true;
    this.render();
    try {
      const result = await this.client.get("/account/feedback");
      this.feedback = result.feedback ?? [];
    } catch (error) {
      this.feedback = [];
      this.message = messageFor(error);
      this.messageIsError = true;
    } finally {
      this.feedbackLoading = false;
      this.render();
    }
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
    if (this.route === "roster") content = renderRoster({ profile: this.profile, selectedId: this.rosterSelectedId, fillSlotId: this.fillSlotId, enhanceOpen: this.enhanceOpen, replaceOpen: this.replaceOpen, dismissOpen: this.dismissOpen, dismissSelected: this.dismissSelected, dismissConfirmPending: this.dismissConfirmPending, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "progression") content = renderProgression({ profile: this.profile, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "account") content = renderAccountScreen({ account: this.account, feedback: this.feedback ?? [], feedbackLoading: this.feedbackLoading, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "battle" && this.battle) content = renderBattle({ battle: this.battle, message: this.message, messageIsError: this.messageIsError });
    else if (this.route === "modes") {
      let liveHtml = "";
      if (this.arena.match && this.arena.playbackState && !this.arena.replay) {
        liveHtml = renderLiveBattle({ battle: { snapshot: this.arena.match.snapshots.attacker }, state: this.arena.playbackState });
      }
      content = renderModes({ profile: this.profile, modeTab: this.modes.tab, message: this.message, messageIsError: this.messageIsError, arenaProps: { ...this.arena, liveHtml }, bossProps: { ...this.boss } });
    }
    else content = renderCampaign({ profile: this.profile, selectedLevelId: this.selectedLevelId, message: this.message, messageIsError: this.messageIsError });
    const detailStudent = this.detailStudentId ? this.profile.students?.[this.detailStudentId] : null;
    const rosterAbilityMax = Math.max(0, ...Object.values(this.profile.students ?? {}).flatMap((student) => Object.values(student.abilities ?? {})));
    const dismissible = Boolean(detailStudent
      && !Object.values(this.profile.formation ?? {}).includes(detailStudent.id));
    const lineupDialog = this.lineupOpen && this.route === "roster" ? renderLineupDialog({ profile: this.profile }) : "";
    this.root.innerHTML = renderShell({ account: this.account, route: this.route, content: `${content}${lineupDialog}${renderStudentDetail({ student: detailStudent, editingName: this.detailNameEditing, dismissible, abilityScaleMax: rosterAbilityMax })}` });
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
      const formData = new FormData(enhanceForm);
      try {
        await this.train(enhanceForm.dataset.studentId, formData.get("enhance-ability"), formData.get("enhance-quantity"));
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
      this.feedback = null;
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
    const battleResultOverlay = event.target.closest("[data-battle-result-overlay]");
    if (battleResultOverlay) {
      event.preventDefault();
      const confirmedByButton = Boolean(event.target.closest('[data-action="close-battle-result"]'));
      if (this.battle) this.battle.resultDialogOpen = false;
      if (confirmedByButton && this.battle?.settlement) {
        if (this.battle.mode === "boss") this.modes.tab = "boss-rush";
        this.navigate(this.battle.mode === "arena" || this.battle.mode === "boss" ? "modes" : "campaign");
        return;
      }
      this.render();
      return;
    }
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
    if (button.matches("[data-select-roster-slot]")) {
      event.preventDefault();
      this.fillSlotId = button.dataset.selectRosterSlot;
      this.rosterSelectedId = null;
      this.enhanceOpen = false;
      this.replaceOpen = false;
      this.message = "";
      this.render();
      return;
    }
    if (button.matches("[data-select-roster-student]")) {
      event.preventDefault();
      this.rosterSelectedId = button.dataset.selectRosterStudent;
      this.fillSlotId = null;
      this.enhanceOpen = false;
      this.replaceOpen = false;
      this.message = "";
      this.render();
      return;
    }
    if (button.matches("[data-fill-with]")) {
      event.preventDefault();
      await this.fillRosterSlot(button.dataset.fillTarget, button.dataset.fillWith);
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
    if (button.matches("[data-mode-tab]")) {
      event.preventDefault();
      this.modes.tab = button.dataset.modeTab;
      if (this.modes.tab === "boss-rush" && this.boss.dailyLimit === null) void this.refreshBossQuota();
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
        this.feedback = null;
        this.activePlaybacks().forEach((playback) => playback.pause());
        this.battle = null;
        this.lineupOpen = false;
        this.rosterSelectedId = null;
        this.fillSlotId = null;
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
      } else if (action === "enhance-fill-max") {
        this.fillEnhanceQuantityMax(button);
        return;
      } else if (action === "open-lineup-editor") {
        this.lineupOpen = true;
        this.message = "拖拽卡片即可互换站位或填入空位，修改即时保存。";
      } else if (action === "close-lineup-editor") {
        this.lineupOpen = false;
        this.message = "";
      } else if (action === "cancel-fill") {
        this.fillSlotId = null;
        this.message = "";
      } else if (action === "open-replace") {
        this.replaceOpen = true;
        this.fillSlotId = null;
        this.enhanceOpen = false;
        this.message = "";
      } else if (action === "cancel-replace") {
        this.replaceOpen = false;
        this.message = "";
      } else if (action === "open-enhance") {
        this.enhanceOpen = true;
        this.fillSlotId = null;
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
      } else if (action === "start-boss-challenge") {
        await this.startBossChallenge();
      } else if (action === "settle-boss-challenge") {
        await this.settleBoss();
      } else if (action === "load-boss-history") {
        this.boss.history = await this.client.get("/boss/challenges?limit=20");
        this.message = "挑战历史已刷新。";
      } else if (action === "close-battle-result") {
        if (this.battle) this.battle.resultDialogOpen = false;
      } else if (action === "start-live-battle") {
        this.activePlaybacks().forEach((playback) => playback.start());
        this.message = "正在播放本局对战。";
      } else if (action === "pause-live-battle") {
        this.activePlaybacks().forEach((playback) => playback.pause());
        this.message = "对战播放已暂停。";
      } else if (action === "step-live-battle") {
        this.activePlaybacks().forEach((playback) => playback.step());
        this.message = "已推进一个对战阶段。";
      } else if (action === "restart-live-battle") {
        this.activePlaybacks().forEach((playback) => playback.restart());
        this.message = "已重播本局战斗。";
      } else if (action === "skip-live-battle") {
        this.activePlaybacks().forEach((playback) => playback.skip());
        this.message = "已跳过对战过程。";
      } else if (button.dataset.playbackSpeed) {
        this.activePlaybacks().forEach((playback) => playback.setSpeed(button.dataset.playbackSpeed));
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
          if (saved.snapshot) this.arena.defenseSnapshot = saved.snapshot;
          this.message = "防守编队已锁定。";
        }
      } else if (action === "settle-arena") {
        await this.settleArena();
      } else if (action === "export-account") {
        const exported = await this.client.get("/account/export");
        downloadJson(exported, `super-oi-${this.account.id}.json`);
        this.message = "训练数据已下载。";
      } else if (action === "refresh-feedback") {
        await this.refreshFeedback();
        return;
      } else if (action === "train") {
        await this.train();
      } else if (action === "recruit") {
        await this.recruit();
      } else if (button.dataset.opponentId) {
        this.arena.match = await this.client.post("/arena/matches", { opponentId: button.dataset.opponentId });
        this.arena.replay = null;
        if (this.arena.dailyLimit !== null) this.arena.battlesToday = Math.min((this.arena.battlesToday ?? 0) + 1, this.arena.dailyLimit);
        const snapshots = this.arena.match.snapshots ?? {};
        const playbacks = {};
        const playbackStates = {};
        for (const side of ["attacker", "defender"]) {
          try {
            const playback = createBattlePlayback(snapshots[side]);
            if (!playback) continue;
            playbacks[side] = playback;
            playbackStates[side] = playback.getState();
            playback.subscribe((state) => {
              if (this.battle?.mode === "arena" && this.battle.playbacks?.[side] === playback) {
                this.battle.playbackStates[side] = state;
                this.render();
                if (state.phase === "result" && this.arenaPlaybackComplete()) void this.settleArena();
              }
            });
            playback.start();
          } catch (error) {
            // Playback is a visual aid; server settlement remains authoritative.
          }
        }
        this.battle = {
          ...this.arena.match,
          mode: "arena",
          settlement: null,
          settlementPending: false,
          settlementError: null,
          resultDialogOpen: false,
          playbacks,
          playbackStates,
          quotaText: this.arena.dailyLimit === null
            ? ""
            : `今日剩余挑战次数 ${Math.max(this.arena.dailyLimit - (this.arena.battlesToday ?? 0), 0)} / ${this.arena.dailyLimit}`,
        };
        this.message = "比赛快照已锁定，对战过程播放中。";
        this.navigate("battle");
        if (!Object.keys(playbacks).length) void this.settleArena();
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
      if (this.battle?.resultDialogOpen) {
        event.preventDefault();
        this.battle.resultDialogOpen = false;
        this.render();
        return;
      }
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

  async fillRosterSlot(slot, studentId) {
    const formation = { ...this.profile.formation };
    const incoming = this.profile.students?.[studentId];
    if (!POSITIONS.includes(slot) || !incoming || Object.values(formation).includes(studentId)) {
      this.message = "无法安排该学生上场，请刷新后重试。";
      this.render();
      return;
    }
    if (formation[slot]) {
      this.message = "该站位已有学生，请在其档案页使用「替换学生」。";
      this.render();
      return;
    }
    formation[slot] = studentId;
    try {
      await this.applyFormation(formation);
      this.fillSlotId = null;
      this.rosterSelectedId = studentId;
      this.message = `${incoming.name} 已安排到 ${slot} 位。`;
    } catch (error) {
      this.message = messageFor(error);
    }
    this.render();
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
    this.battle = {
      ...started,
      settlement: null,
      settlementPending: false,
      settlementError: null,
      resultDialogOpen: false,
      playback: null,
      playbackState: null,
    };
    try {
      const playback = createBattlePlayback(started.snapshot);
      if (playback) {
        this.battle.playback = playback;
        this.battle.playbackState = playback.getState();
        playback.subscribe((state) => {
          if (this.battle?.playback === playback) {
            this.battle.playbackState = state;
            this.render();
            if (state.phase === "result") void this.settleBattle();
          }
        });
        playback.start();
      }
    } catch (error) {
      // Older test fixtures may return a minimal snapshot. Server settlement
      // remains available even when a local visual playback cannot be built.
      this.message = `快照已锁定，等待服务端回放（${error.message}）。`;
      this.navigate("battle");
      void this.settleBattle();
      return;
    }
    this.message = "战斗快照已由服务端创建。";
    this.navigate("battle");
  }

  async settleBattle() {
    const battle = this.battle;
    if (!battle || battle.mode || battle.settlement || battle.settlementPending) return;
    battle.settlementPending = true;
    battle.settlementError = null;
    this.message = "对战已结束，正在自动结算。";
    this.messageIsError = false;
    this.render();
    try {
      battle.playback?.pause();
      battle.settlement = await this.client.post(`/campaign/battles/${battle.id}/settle`);
      if (battle.settlement.profile) this.profile = battle.settlement.profile;
      battle.resultDialogOpen = true;
      this.message = "服务端结算已完成。";
    } catch (error) {
      battle.settlementError = messageFor(error);
      this.message = `自动结算失败：${battle.settlementError}`;
      this.messageIsError = isErrorRateLimited(error);
    } finally {
      if (this.battle === battle) {
        battle.settlementPending = false;
        this.render();
      }
    }
  }

  arenaPlaybackComplete() {
    const battle = this.battle;
    const playbacks = Object.values(battle?.playbacks ?? {});
    return playbacks.length > 0 && playbacks.every((playback) => playback.getState().phase === "result");
  }

  async startBossChallenge() {
    const formation = { ...this.profile.formation };
    const teamIds = POSITIONS.map((slot) => formation[slot]).filter(Boolean);
    if (!teamIds.length) {
      this.message = "请先在学生名单安排至少一名上场学生。";
      return;
    }
    const started = await this.client.post("/boss/challenges", { version: this.profile.version, teamIds, formation });
    this.boss.match = started;
    if (this.boss.dailyLimit !== null) this.boss.battlesToday = Math.min((this.boss.battlesToday ?? 0) + 1, this.boss.dailyLimit);
    let playback = null;
    try {
      playback = createBattlePlayback(started.snapshot);
    } catch (error) {
      // Playback is a visual aid; server settlement remains authoritative.
    }
    this.battle = {
      ...started,
      mode: "boss",
      settlement: null,
      settlementPending: false,
      settlementError: null,
      resultDialogOpen: false,
      playback,
      playbackState: playback?.getState() ?? null,
    };
    if (playback) {
      playback.subscribe((state) => {
        if (this.battle?.playback === playback) {
          this.battle.playbackState = state;
          this.render();
          if (state.phase === "result") void this.settleBoss();
        }
      });
      playback.start();
      this.message = "BOSS战快照已由服务端创建。";
    } else {
      this.message = "快照已锁定，等待服务端结算。";
      void this.settleBoss();
    }
    this.navigate("battle");
  }

  async settleBoss() {
    const battle = this.battle?.mode === "boss" ? this.battle : null;
    if (!battle || battle.settlement || battle.settlementPending) return;
    battle.settlementPending = true;
    battle.settlementError = null;
    this.message = "对战已结束，正在自动结算。";
    this.messageIsError = false;
    this.render();
    try {
      battle.playback?.pause();
      const settlement = await this.client.post(`/boss/challenges/${battle.id}/settle`, {});
      battle.settlement = settlement;
      if (settlement.profile) this.profile = settlement.profile;
      battle.resultDialogOpen = true;
      this.message = "服务端结算已完成。";
    } catch (error) {
      battle.settlementError = messageFor(error);
      this.message = `自动结算失败：${messageFor(error)}`;
      this.messageIsError = isErrorRateLimited(error);
    } finally {
      if (this.battle === battle) {
        battle.settlementPending = false;
        this.render();
      }
    }
  }

  async settleArena() {
    const battle = this.battle?.mode === "arena" ? this.battle : null;
    const arenaMatch = battle ?? this.arena.match;
    if (!arenaMatch || battle?.settlement || battle?.settlementPending || this.arena.replay) return;
    if (battle) {
      battle.settlementPending = true;
      battle.settlementError = null;
    }
    this.message = "对战已结束，正在自动结算。";
    this.messageIsError = false;
    this.render();
    try {
      const replay = await this.client.post(`/arena/matches/${arenaMatch.id}/settle`, {});
      this.arena.replay = replay;
      this.activePlaybacks().forEach((playback) => playback.pause());
      if (battle) {
        battle.settlement = replay;
        battle.resultDialogOpen = true;
      }
      this.profile = replay.profile ?? await this.client.get("/profile");
      this.message = "竞技场对战已结算。";
    } catch (error) {
      if (battle) battle.settlementError = messageFor(error);
      this.message = `自动结算失败：${messageFor(error)}`;
      this.messageIsError = isErrorRateLimited(error);
    } finally {
      if (battle && this.battle === battle) {
        battle.settlementPending = false;
        this.render();
      }
    }
  }

  async saveName(studentId) {
    const input = this.root.querySelector(`[data-name-input="${studentId}"]`);
    this.profile = await this.client.put("/profile", { version: this.profile.version, students: { [studentId]: { name: input?.value ?? "" } } });
    this.detailNameEditing = false;
    this.message = "学生名称已保存。";
  }

  onChange(event) {
    const enhanceForm = event.target.closest?.("[data-enhance-form]");
    if (enhanceForm && event.target.name === "enhance-ability") {
      this.updateEnhanceAvailability(enhanceForm);
    }
  }

  enhanceAvailableUnits(studentId, ability) {
    const inventory = this.profile?.inventory ?? {};
    return (inventory[`specialist-book-${ability}`] ?? 0) + (inventory["student-training-material"] ?? 0);
  }

  updateEnhanceAvailability(form) {
    const ability = form.querySelector("input[name='enhance-ability']:checked")?.value;
    const hint = form.querySelector("[data-enhance-available]");
    if (!ability || !hint) return;
    const student = this.profile?.students?.[form.dataset.studentId];
    const total = this.enhanceAvailableUnits(form.dataset.studentId, ability);
    const increment = student ? SPECIALIST_TRAINING_INCREMENTS[student.aptitude] : null;
    hint.textContent = increment
      ? `当前可用：${total} 次（每次 +${increment}，拉满共 +${total * increment}）`
      : `当前可用：${total} 次`;
  }

  fillEnhanceQuantityMax(button) {
    const form = button.closest("[data-enhance-form]");
    if (!form) return;
    const ability = form.querySelector("input[name='enhance-ability']:checked")?.value;
    if (!ability) {
      this.message = "请先选择要提升的能力。";
      this.render();
      return;
    }
    const total = this.enhanceAvailableUnits(form.dataset.studentId, ability);
    this.updateEnhanceAvailability(form);
    const input = form.querySelector("[data-enhance-quantity]");
    if (input) input.value = String(Math.max(total, 1));
  }

  async train(studentId, ability, quantityRaw) {
    if (!studentId || !ability) throw new Error("请选择要提升的能力。");
    const parsed = Number.parseInt(quantityRaw ?? "1", 10);
    const quantity = Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
    const result = await this.client.post("/progression/training/specialist", { studentId, ability, quantity });
    this.profile = result.profile;
    this.enhanceOpen = true;
    const training = result.training;
    if (!training) {
      this.message = "学生强化完成。";
      return;
    }
    const parts = [];
    if (training.usedBooks > 0) parts.push(`专项训练册 ×${training.usedBooks}`);
    if (training.usedMaterial > 0) parts.push(`学生培养材料 ×${training.usedMaterial}`);
    this.message = `学生强化完成，数值 ${training.previousValue} → ${training.currentValue}，消耗 ${parts.join(" + ") || "无资源"}。`;
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
    this.message = `学生已劝退，获得 ${result.dismissal?.quantity ?? 1} 份学生培养材料。${refundSummaryText(result.dismissal?.refunded)}`;
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
    this.message = `已劝退 ${count} 名学生，共获得 ${quantity} 份学生培养材料。${refundSummaryText(result.dismissal?.refunded)}`;
  }

  async useEnergyTonic(studentId) {
    if (!studentId) throw new Error("请先选择要食用KFC的学生。");
    const result = await this.client.post(`/progression/students/${encodeURIComponent(studentId)}/energy`, {});
    this.profile = result.profile;
    const energy = result.energy;
    this.message = energy
      ? `精力上限已提升：${energy.previousValue} → ${energy.currentValue}，已消耗 1 份 KFC。`
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
        this.feedback = null;
        this.battle = null;
        this.message = "密码已更新，请使用新密码重新登录。";
      } else if (form.dataset.accountForm === "feedback") {
        const result = await this.client.post("/account/feedback", {
          category: values.category,
          message: values.message,
        });
        if (this.account.role === "admin" && Array.isArray(this.feedback)) {
          this.feedback = [result.feedback, ...this.feedback];
        }
        this.message = "反馈已提交，感谢你的建议。";
      } else if (form.dataset.accountForm === "account-deletion") {
        if (values.confirmed !== "on") throw new Error("请确认删除账户。");
        await this.client.delete("/account", { password: values.password });
        this.account = null;
        this.profile = null;
        this.feedback = null;
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
