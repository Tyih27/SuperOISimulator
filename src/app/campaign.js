import { LEVELS } from "../data.js";

const levelById = new Map(LEVELS.map((level) => [level.id, level]));

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function studentOption(student, selected) {
  return `<label class="student-choice"><input type="checkbox" data-student-toggle value="${esc(student.id)}"${selected ? " checked" : ""}><span><strong>${esc(student.name)}</strong><small>${esc(student.aptitude)} · 精力 ${esc(student.maxEnergy)}</small></span></label>`;
}

function positionOptions(students, current) {
  return [`<option value="">未安排</option>`, ...students.map((student) => `<option value="${esc(student.id)}"${student.id === current ? " selected" : ""}>${esc(student.name)}</option>`)].join("");
}

export function getLevel(levelId) {
  return levelById.get(levelId) ?? LEVELS[0];
}

export function renderCampaign({ profile, selectedLevelId, teamIds, formation, message }) {
  const selectedLevel = getLevel(selectedLevelId);
  const ownedStudents = Object.values(profile.students);
  const selectedStudents = ownedStudents.filter((student) => teamIds.includes(student.id));
  return `<section class="app-view campaign-view" aria-labelledby="campaign-title">
    <div class="view-heading"><div><p class="eyebrow">主线关卡</p><h1 id="campaign-title">第 1 章</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div>
    <div class="level-list" aria-label="主线关卡">${LEVELS.map((level) => {
      const unlocked = profile.unlockedLevelIds.includes(level.id);
      const selected = selectedLevel.id === level.id;
      return `<button type="button" class="level-card${selected ? " is-selected" : ""}" data-select-level="${esc(level.id)}"${unlocked ? "" : " disabled"}><span>第 ${level.order} 关</span><strong>${esc(level.name)}</strong><small>${unlocked ? `推荐能力 ${level.recommendedAbility}` : "尚未解锁"}</small></button>`;
    }).join("")}</div>
    <section class="campaign-detail" aria-labelledby="selected-level-title">
      <div><p class="eyebrow">当前挑战</p><h2 id="selected-level-title">${esc(selectedLevel.name)}</h2><p>在 ${selectedLevel.maxRounds} 回合内完成${selectedLevel.objective.type === "all" ? "全部题目" : `至少 ${selectedLevel.objective.requiredTopics} 道题目`}。</p></div>
      <div class="reward-summary">奖励<br><strong>${selectedLevel.reward.trainingCoins ?? 0} 训练币</strong></div>
    </section>
    <section class="formation-workbench" aria-labelledby="formation-title">
      <div class="section-heading"><div><p class="eyebrow">出战编队</p><h2 id="formation-title">选择 3 名学生</h2></div><strong class="formation-count${teamIds.length === 3 ? "" : " is-invalid"}">${teamIds.length} / 3</strong></div>
      <div class="campaign-formation-grid"><fieldset><legend>参战名单</legend><div class="student-choices">${ownedStudents.map((student) => studentOption(student, teamIds.includes(student.id))).join("")}</div></fieldset><fieldset><legend>行动站位</legend><div class="position-selectors">${["A1", "A2", "A3"].map((slot) => `<label>${slot} 站位<select data-position="${slot}">${positionOptions(selectedStudents, formation[slot])}</select></label>`).join("")}</div></fieldset></div>
      <div class="formation-actions"><button type="button" class="secondary-button" data-action="save-formation">保存编队</button><button type="button" class="primary-button" data-action="start-battle">开始挑战</button></div>
    </section>
  </section>`;
}
