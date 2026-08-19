import { LEVELS, SKILL_GROUPS, STUDENTS, TOPICS } from "../data.js";
import { calculateOverallPower } from "../combat/math.js";
import { createProfile } from "../domain/profile.js";
import { FormationController } from "./formation.js";
import { createPlayback } from "./state.js";

const level = LEVELS[0];
const playerProfile = createProfile({
  accountId: "local-prototype",
  studentIds: STUDENTS.map((student) => student.id),
  identitySeed: "local-prototype-v2",
});
const studentById = playerProfile.students;
const playerStudents = Object.values(studentById);
const topicById = Object.fromEntries(TOPICS.map((topic) => [topic.id, topic]));
const skillGroups = SKILL_GROUPS;
const abilityLabels = { dynamicProgramming: "动态规划", graphTheory: "图论", dataStructures: "数据结构", mathematics: "数学", implementation: "代码实现" };
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
const format = (value) => Number(value ?? 0).toLocaleString("zh-CN");
const percent = (value, total) => Math.max(0, Math.min(100, total ? (value / total) * 100 : 0));

function studentSkill(studentData, runtimeStudent) {
  const group = skillGroups[studentData?.skillGroupId];
  if (!group) return { group: null, skill: null, mode: "normal" };
  const mode = (runtimeStudent?.focus ?? 0) >= (level.focusMax ?? 1000) ? "burst" : "normal";
  return { group, skill: group.skills?.[mode] ?? null, mode };
}

function topicSkill(topicId, runtimeTopic) {
  if (runtimeTopic?.skill) return runtimeTopic.skill;
  const topic = topicById[topicId];
  if (!topic) return null;
  return topic.skill ?? null;
}

const playback = createPlayback({ combatOptions: { students: playerStudents, seed: level.seed, maxRounds: level.maxRounds, goal: { type: level.objective.type, target: level.objective.requiredTopics } } });
const formation = new FormationController(STUDENTS.map((student) => student.id));
let formationConfirmed = false;

function populateFormationSelectors() {
  document.querySelectorAll("[data-formation-slot]").forEach((select) => {
    select.insertAdjacentHTML("beforeend", playerStudents.map((student) => `<option value="${esc(student.id)}">${esc(student.name)} · ${esc(student.aptitude)}</option>`).join(""));
  });
  document.querySelectorAll('input[name="roster"]').forEach((input) => {
    const student = studentById[input.value];
    input.closest(".roster-option").querySelector("strong").textContent = student.name;
    input.closest(".roster-option").querySelector("small").textContent = `${student.aptitude}资质`;
  });
}

function renderFormation(state = playback.getState()) {
  const selected = new Set(formation.selectedIds);
  document.querySelectorAll('input[name="roster"]').forEach((input) => {
    input.checked = selected.has(input.value);
    input.disabled = state.phase !== "formation";
    input.closest(".roster-option").classList.toggle("is-selected", input.checked);
  });
  document.querySelectorAll("[data-formation-slot]").forEach((select) => {
    const slot = select.dataset.formationSlot;
    select.value = formation.positions[slot] ?? "";
    select.disabled = state.phase !== "formation";
    [...select.options].forEach((option) => {
      option.disabled = Boolean(option.value && selected.has(option.value) && option.value !== formation.positions[slot]);
    });
  });

  $("#formation-count").textContent = `${formation.selectedIds.length} / 3`;
  $("#formation-count").classList.toggle("is-invalid", !formation.isValid);
  $("#formation-error").textContent = formation.error
    ?? (formation.isValid ? (formationConfirmed ? "编队已确认，可以开始战斗。" : "") : `还需选择 ${3 - formation.selectedIds.length} 名学生。`);
  $("#confirm-formation").disabled = !formation.isValid || state.phase !== "formation";
  $("#formation-panel").hidden = state.phase !== "formation";
}

function updateFormation(mutator) {
  mutator();
  formationConfirmed = false;
  renderFormation();
  render(playback.getState());
}

function phaseLabel(phase) {
  return { formation: "编队", ready: "准备中", battle: "战斗中", result: "已结算" }[phase] ?? phase;
}

function eventText(entry, state) {
  const actor = studentById[entry.actor]?.name ?? topicById[entry.actor]?.name ?? entry.actor ?? "系统";
  const targets = (entry.targets ?? []).map((id) => studentById[id]?.name ?? topicById[id]?.name ?? id).join("、");
  if (entry.type === "round_start") return `第 ${entry.round} 回合开始，活动题目已补位。`;
  if (entry.type === "stage_start") return `${entry.stage} 行动阶段：${actor} 准备行动。`;
  if (entry.type === "action") {
    const kind = topicById[entry.actor] ? "题目技能" : (entry.burst ? "爆发技能" : "常规技能");
    return `${actor} 使用${kind}「${entry.skillName ?? "未命名技能"}」${targets ? `，目标 ${targets}` : ""}。`;
  }
  if (entry.type === "skip") return `${actor} 跳过本次行动：${entry.reason === "energy-zero" ? "精力耗尽" : "没有可用目标"}。`;
  if (entry.type === "effect") return (entry.effects ?? []).map((effect) => {
    const target = studentById[effect.target]?.name ?? topicById[effect.target]?.name ?? effect.target;
    if (effect.kind === "problem-progress") return `${target} 完成度 +${format(effect.delta)}。`;
    if (effect.kind === "energy") return `${target} 精力 ${format(effect.before)} → ${format(effect.after)}。`;
    if (effect.kind === "focus") return `${target} 专注 ${format(effect.before)} → ${format(effect.after)}。`;
    return `${target} 获得能力增益。`;
  }).join(" ");
  if (entry.type === "problem_completed") return `${topicById[entry.problem]?.name ?? entry.problem} 已通过。`;
  if (entry.type === "student_exit") return `${studentById[entry.student]?.name ?? entry.student} 精力归零，退出战斗。`;
  if (entry.type === "round_end") return `第 ${entry.round} 回合结束，已通过 ${entry.completedCount} 道题。`;
  if (entry.type === "battle_end") return entry.result === "win" ? "达成关卡目标，战斗胜利。" : `战斗结束：${entry.reason === "round-limit" ? "回合耗尽" : "全员退出"}。`;
  return entry.type;
}

function latestAction(events) {
  return [...events].reverse().find((entry) => entry.type === "action") ?? null;
}

function renderStudents(state) {
  const root = $("#student-list");
  const combat = state.combat?.state;
  if (!combat) { root.innerHTML = "<p class=\"empty-state\">准备战斗以载入队伍。</p>"; return; }
  const lastStage = [...(state.combat.events ?? [])].reverse().find((entry) => entry.type === "stage_start");
  root.innerHTML = Object.entries(state.positions).map(([slot, id]) => {
    const data = studentById[id];
    const student = combat.students[id];
    if (!data || !student) return "";
    const { group, skill: currentSkill, mode } = studentSkill(data, student);
    const abilities = Object.entries(data.abilities).map(([key, value]) => `${abilityLabels[key]} ${value}`).join(" · ");
    const active = lastStage?.actor === id && lastStage.stage.startsWith("A");
    return `<article class="student-card${active ? " is-active" : ""}${student.alive ? "" : " is-inactive"}" aria-label="${esc(slot)} ${esc(data.name)} ${student.alive ? "存活" : "已退出"}">
      <div class="student-card-head"><span class="slot-label">${esc(slot)}</span><span class="alive-state">${student.alive ? "存活" : "已退出"}</span></div>
      <div class="student-name-row"><span class="student-name">${esc(data.name)}</span><span class="student-role">${esc(data.aptitude)}资质</span></div>
      <p class="ability-summary" title="${esc(abilities)}">能力 ${format(calculateOverallPower(data))} <span>${esc(data.aptitude)}</span></p>
      <div class="stat-line"><span>精力</span><strong>${format(student.energy)} / ${format(data.maxEnergy)}</strong></div>
      <div class="meter energy" aria-label="精力 ${Math.round(percent(student.energy, data.maxEnergy))}%"><span style="width:${percent(student.energy, data.maxEnergy)}%"></span></div>
      <div class="stat-line"><span>专注</span><strong>${format(student.focus)} / 1,000</strong></div>
      <div class="meter focus" aria-label="专注 ${Math.round(percent(student.focus, 1000))}%"><span style="width:${percent(student.focus, 1000)}%"></span></div>
      <div class="student-footer"><span class="skill-chip">${esc(group?.name ?? "未配置技能组")} · ${esc(currentSkill?.name ?? "未配置技能")} · ${mode === "burst" ? "爆发就绪" : "常规技能"}</span><span class="student-position">${active ? "当前行动" : "自动行动"}</span></div>
    </article>`;
  }).join("");
}

function topicKind(topic) {
  return Object.entries(topic.difficulties ?? {}).filter(([, value]) => value > 0).map(([key]) => abilityLabels[key]).join(" · ");
}

function renderTopics(state) {
  const root = $("#topic-list");
  const combat = state.combat?.state;
  if (!combat) { root.innerHTML = "<p class=\"empty-state\">题目将在准备阶段载入。</p>"; return; }
  const latest = latestAction(state.combat.events ?? []);
  root.innerHTML = Object.entries(combat.activeProblems ?? {}).map(([slot, id]) => {
    if (!id) return `<article class="topic-card topic-empty"><span class="slot-label">${slot}</span><strong>等待补位</strong><span>下一回合自动补充</span></article>`;
    const topic = combat.problems[id];
    const base = topicById[id] ?? topic;
    const skill = topicSkill(id, topic);
    const focused = latest?.targets?.includes(id);
    const completed = topic.progress >= topic.maxProgress;
    const status = completed ? "已通过" : focused ? "当前目标" : "进行中";
    return `<article class="topic-card${focused ? " is-focused" : ""}${completed ? " is-complete" : ""}" aria-label="${esc(slot)} ${esc(base.name)} ${status}">
      <div class="topic-name-row"><span class="slot-label">${slot}</span><span class="topic-difficulty">难度 ${format(Object.values(base.difficulties ?? {}).reduce((sum, value) => sum + value, 0))}</span></div>
      <div class="topic-name">${esc(base.name)}</div><div class="topic-kind">${esc(topicKind(base))}</div>
      <div class="topic-kind">题目技能 · ${esc(skill?.name ?? "未配置技能")}</div>
      <div class="topic-progress-label"><span>完成进度</span><strong>${format(topic.progress)} / ${format(topic.maxProgress)}</strong></div>
      <div class="topic-progress" aria-label="${esc(base.name)} 完成进度 ${Math.round(percent(topic.progress, topic.maxProgress))}%"><span style="width:${percent(topic.progress, topic.maxProgress)}%"></span></div>
      <div class="topic-footer"><span class="topic-state">${status}</span><span class="position-badge">正对 ${slot.replace("B", "A")}</span></div>
    </article>`;
  }).join("");
  $("#queue-count").textContent = `候补 ${(combat.queue ?? []).length} 道`;
}

function renderSkills(state) {
  const combat = state.combat?.state;
  if (!combat) { $("#skill-list").innerHTML = "<p class=\"empty-state\">技能将在战斗开始后显示。</p>"; return; }
  $("#skill-list").innerHTML = Object.entries(state.positions).map(([slot, id]) => {
    const data = studentById[id]; const student = combat.students[id];
    const { group, skill: current, mode } = studentSkill(data, student);
    return `<div class="skill-row"><span class="skill-icon" aria-hidden="true">${mode === "burst" ? "B" : "A"}</span><div><div class="skill-name">${esc(data.name)} · ${esc(current?.name ?? "未配置技能")}</div><div class="skill-desc">${esc(group?.name ?? "未配置技能组")} · ${esc(current?.category === "support" ? "辅助技能" : "解题技能")} · ${slot} 位置 · 专注 ${format(student.focus)} / ${format(level.focusMax ?? 1000)}</div></div><span class="skill-type">${mode === "burst" ? "爆发" : "常规"}</span></div>`;
  }).join("");
}

function renderAction(state) {
  const combat = state.combat;
  const events = state.combat?.events ?? [];
  const action = latestAction(events);
  const actor = action ? (studentById[action.actor]?.name ?? topicById[action.actor]?.name ?? action.actor) : null;
  const actorIsTopic = Boolean(action && !studentById[action.actor] && topicById[action.actor]);
  const actorSkill = actorIsTopic
    ? topicSkill(action.actor, combat?.state?.problems?.[action.actor])
    : action && studentById[action.actor] && combat?.state?.students?.[action.actor]
      ? studentSkill(studentById[action.actor], combat.state.students[action.actor]).skill
      : null;
  const skillCategory = action?.category ?? actorSkill?.category;
  $("#action-title").textContent = actor ? `${actor} · ${action.skillName ?? actorSkill?.name ?? "未命名技能"}` : state.phase === "result" ? "战斗已结束" : "等待开始";
  $("#action-description").textContent = action
    ? `${actorIsTopic ? "题目技能" : (action.burst ? "爆发技能" : "常规技能")}${skillCategory === "support" ? " · 辅助" : " · 解题"}，结算结果已写入事件日志。`
    : "战斗开始后，这里会说明行动者、技能和目标。";
  const target = action?.targets?.[0];
  $("#action-target").textContent = target ? `目标：${studentById[target]?.name ?? topicById[target]?.name ?? target}` : "暂无事件";
  const effect = [...events].reverse().find((entry) => entry.type === "effect" || entry.type === "problem_completed" || entry.type === "student_exit");
  $("#action-effect").textContent = effect ? eventText(effect, state) : "—";
}

function renderLog(state) {
  const root = $("#event-log");
  const events = state.combat?.events ?? [];
  if (!events.length) { root.innerHTML = "<p class=\"empty-state\">事件会按回合显示在这里。</p>"; return; }
  const stick = root.scrollHeight - root.scrollTop - root.clientHeight < 8;
  const grouped = new Map();
  events.forEach((entry) => { const key = entry.round ?? 0; if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(entry); });
  const rounds = [...grouped.entries()];
  root.innerHTML = rounds.map(([round, entries], index) => `<details class="log-round"${index === rounds.length - 1 ? " open" : ""}><summary>第 ${round || "准备"} 回合 <span>${entries.length} 条事件</span></summary><div class="log-round-items">${entries.map((entry) => `<div class="log-entry"><span class="log-time">${esc(entry.stage ?? entry.type.replaceAll("_", " "))}</span><p class="log-message">${esc(eventText(entry, state))}</p></div>`).join("")}</div></details>`).join("");
  if (stick) root.scrollTop = root.scrollHeight;
}

function renderResult(state) {
  const combat = state.combat;
  const panel = $("#result-panel");
  const result = state.result;
  panel.hidden = state.phase !== "result" || !result;
  if (!result) return;
  const win = result.result === "win";
  $("#result-title").textContent = win ? "战斗胜利" : "战斗失败";
  $("#result-reason").textContent = win ? "关卡目标已达成，可以继续挑战相同种子。" : (result.reason === "round-limit" ? "回合数耗尽，尚未达成目标。" : "所有学生均已退出战斗。");
  $("#result-completed").textContent = format(result.completedCount);
  $("#result-energy").textContent = format(result.remainingEnergy);
  $("#result-round").textContent = format(result.round);
  panel.classList.toggle("is-win", win);
  $("#settlement-label span").textContent = win ? "已胜利" : "已失败";
  $("#settlement-label").classList.toggle("is-result", true);
  void combat;
}

function render(state) {
  const combat = state.combat;
  const completed = combat?.completedCount ?? 0;
  const energy = combat?.remainingEnergy ?? 0;
  $("#round-status").textContent = state.phase === "formation" ? `准备 / ${level.maxRounds}` : `${combat?.round ?? 0} / ${level.maxRounds}`;
  $("#seed-status").textContent = level.seed;
  $("#completed-metric").textContent = `${completed} / ${level.objective.requiredTopics}`;
  $("#energy-metric").textContent = format(energy);
  $("#phase-metric").textContent = phaseLabel(state.phase);
  $("#phase-metric").className = state.phase === "result" ? (state.result?.result === "win" ? "status-win" : "status-lose") : "status-ready";
  $("#objective-label").textContent = `${completed} / ${level.objective.requiredTopics} 道题目`;
  $("#objective-bar").style.width = `${Math.min(100, completed / level.objective.requiredTopics * 100)}%`;
  $("#step-status").textContent = state.lastEvent ? `最近：${state.lastEvent.type}` : "尚未行动";
  $("#live-status").textContent = state.phase === "result" ? (state.result?.result === "win" ? "目标达成，战斗已结算。" : "本局未达成目标，可重新挑战。") : state.phase === "battle" ? `第 ${combat?.round ?? 1} 回合自动播放中。` : state.phase === "ready" ? "队伍已准备，点击开始或单步执行。" : formationConfirmed ? "编队已确认，可以开始战斗。" : "选择三名学生并确认编队。";
  $("#start-button").disabled = state.phase === "result" || (state.phase === "formation" && (!formation.isValid || !formationConfirmed));
  $("#start-button span").textContent = state.phase === "battle" && state.playing ? "播放中" : "开始战斗";
  $("#pause-button").disabled = state.phase !== "battle" || !state.playing;
  $("#step-button").disabled = state.phase === "result" || (state.phase === "formation" && (!formation.isValid || !formationConfirmed));
  $("#restart-top").disabled = state.phase === "formation";
  renderFormation(state);
  renderStudents(state); renderTopics(state); renderSkills(state); renderAction(state); renderLog(state); renderResult(state);
}

populateFormationSelectors();
document.querySelectorAll('input[name="roster"]').forEach((input) => input.addEventListener("change", () => {
  updateFormation(() => formation.toggle(input.value));
}));
document.querySelectorAll("[data-formation-slot]").forEach((select) => select.addEventListener("change", () => {
  updateFormation(() => formation.assign(select.dataset.formationSlot, select.value || null));
}));
$("#confirm-formation").addEventListener("click", () => {
  if (!formation.isValid) return;
  formation.error = null;
  formationConfirmed = true;
  playback.setFormation({ teamIds: formation.selectedIds, positions: formation.positions });
});
$("#start-button").addEventListener("click", () => playback.start());
$("#pause-button").addEventListener("click", () => playback.pause());
$("#step-button").addEventListener("click", () => playback.step());
$("#restart-top").addEventListener("click", () => {
  if (playback.getState().phase !== "formation") playback.restart();
});
$("#restart-result").addEventListener("click", () => { playback.restart(); playback.start(); });
document.querySelectorAll("[data-speed]").forEach((button) => button.addEventListener("click", () => playback.setSpeed(button.dataset.speed)));
$("#log-toggle").addEventListener("click", () => { const panel = $("#event-log"); panel.classList.toggle("is-collapsed"); const collapsed = panel.classList.contains("is-collapsed"); $("#log-toggle").setAttribute("aria-label", collapsed ? "展开事件日志" : "折叠事件日志"); });
playback.subscribe((state) => {
  document.querySelectorAll("[data-speed]").forEach((button) => { const active = Number(button.dataset.speed) === state.speed; button.classList.toggle("is-active", active); button.setAttribute("aria-pressed", String(active)); });
  render(state);
});
render(playback.getState());
