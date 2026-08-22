import { LEVELS } from "../data.js";
import { calculateTeamPower } from "../combat/math.js";

const FORMATION_SLOTS = ["A1", "A2", "A3"];
const levelById = new Map(LEVELS.map((level) => [level.id, level]));
const MAIN_LEVELS = LEVELS.filter((level) => level.track !== "extra");
const EXTRA_LEVELS = LEVELS.filter((level) => level.track === "extra");

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function getLevel(levelId) {
  return levelById.get(levelId) ?? LEVELS[0];
}

function isExtraLevel(level) {
  return level.track === "extra";
}

function chapterNumber(level) {
  const parsed = Number.parseInt(String(level.id).split("-")[1], 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function teamTotalPower(profile) {
  const studentsById = new Map(Object.values(profile.students ?? {}).map((student) => [student.id, student]));
  const team = FORMATION_SLOTS.map((slot) => {
    const student = studentsById.get(profile.formation?.[slot]);
    return student;
  }).filter(Boolean);
  return calculateTeamPower(team);
}

function recommendationText(level, myPower) {
  if (level.recommendedTotalPower) {
    return `推荐总战力 ${level.recommendedTotalPower} · 我的队伍总战力 ${myPower}`;
  }
  return `推荐能力 ${level.recommendedAbility} · 我的队伍总战力 ${myPower}`;
}

function levelCard(level, { label, selected, unlockedLevelIds }) {
  const unlocked = unlockedLevelIds.includes(level.id);
  return `<button type="button" class="level-card${selected ? " is-selected" : ""}" data-select-level="${esc(level.id)}"${unlocked ? "" : " disabled"}><span>${esc(label)}</span><strong>${esc(level.name)}</strong><small>${unlocked ? (level.recommendedTotalPower ? `推荐总战力 ${level.recommendedTotalPower}` : `推荐能力 ${level.recommendedAbility}`) : "尚未解锁"}</small></button>`;
}

function renderLevelSection({ heading, ariaLabel, levels, selectedId, unlockedLevelIds }) {
  if (!levels.length) return "";
  const cards = levels.map((level, index) => {
    const label = isExtraLevel(level) ? `额外 第 ${index + 1} 关` : `第 ${level.order} 关`;
    return levelCard(level, { label, selected: level.id === selectedId, unlockedLevelIds });
  }).join("");
  const headingHtml = heading ? `<h2 class="level-section-title">${esc(heading)}</h2>` : "";
  return `${headingHtml}<div class="level-list" aria-label="${esc(ariaLabel)}">${cards}</div>`;
}

export function renderCampaign({ profile, selectedLevelId, message }) {
  const selectedLevel = getLevel(selectedLevelId);
  const myPower = teamTotalPower(profile);
  const title = isExtraLevel(selectedLevel) ? "额外关卡" : `第 ${chapterNumber(selectedLevel)} 章`;
  const eyebrow = isExtraLevel(selectedLevel) ? "额外关卡" : "主线关卡";
  return `<section class="app-view campaign-view" aria-labelledby="campaign-title">
    <div class="view-heading"><div><p class="eyebrow">${esc(eyebrow)}</p><h1 id="campaign-title">${esc(title)}</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div>
    ${renderLevelSection({ ariaLabel: "主线关卡", levels: MAIN_LEVELS, selectedId: selectedLevel.id, unlockedLevelIds: profile.unlockedLevelIds })}
    ${renderLevelSection({ heading: "额外关卡", ariaLabel: "额外关卡", levels: EXTRA_LEVELS, selectedId: selectedLevel.id, unlockedLevelIds: profile.unlockedLevelIds })}
    <section class="campaign-detail" aria-labelledby="selected-level-title">
      <div><p class="eyebrow">当前挑战</p><h2 id="selected-level-title">${esc(selectedLevel.name)}</h2><p>在 ${selectedLevel.maxRounds} 回合内完成${selectedLevel.objective.type === "all" ? "全部题目" : `至少 ${selectedLevel.objective.requiredTopics} 道题目`}。</p><p>${esc(recommendationText(selectedLevel, myPower))}</p></div>
      <div class="reward-summary">奖励<br><strong>${selectedLevel.reward.trainingCoins ?? 0} 训练币</strong></div>
    </section>
    <div class="campaign-actions"><a class="secondary-button" href="#roster">管理队伍与站位</a><button type="button" class="primary-button" data-action="start-battle">开始挑战</button></div>
  </section>`;
}
