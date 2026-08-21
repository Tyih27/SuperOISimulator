import { LEVELS } from "../data.js";

const levelById = new Map(LEVELS.map((level) => [level.id, level]));

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function getLevel(levelId) {
  return levelById.get(levelId) ?? LEVELS[0];
}

export function renderCampaign({ profile, selectedLevelId, message, messageIsError = false }) {
  const selectedLevel = getLevel(selectedLevelId);
  return `<section class="app-view campaign-view" aria-labelledby="campaign-title">
    <div class="view-heading"><div><p class="eyebrow">主线关卡</p><h1 id="campaign-title">第 1 章</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div>
    <div class="level-list" aria-label="主线关卡">${LEVELS.map((level) => {
      const unlocked = profile.unlockedLevelIds.includes(level.id);
      const selected = selectedLevel.id === level.id;
      return `<button type="button" class="level-card${selected ? " is-selected" : ""}" data-select-level="${esc(level.id)}"${unlocked ? "" : " disabled"}><span>第 ${level.order} 关</span><strong>${esc(level.name)}</strong><small>${unlocked ? `推荐能力 ${level.recommendedAbility}` : "尚未解锁"}</small></button>`;
    }).join("")}</div>
    <section class="campaign-detail" aria-labelledby="selected-level-title">
      <div><p class="eyebrow">当前挑战</p><h2 id="selected-level-title">${esc(selectedLevel.name)}</h2><p>在 ${selectedLevel.maxRounds} 回合内完成${selectedLevel.objective.type === "all" ? "全部题目" : `至少 ${selectedLevel.objective.requiredTopics} 道题目`}。</p></div>
      <div class="reward-summary">奖励<br><strong>${selectedLevel.reward.trainingCoins ?? 0} 训练币</strong></div>
    </section>
    <div class="campaign-actions"><a class="secondary-button" href="#roster">管理队伍与站位</a><button type="button" class="primary-button" data-action="start-battle">开始挑战</button></div>
  </section>`;
}
