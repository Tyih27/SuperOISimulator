import { ABILITY_KEYS, SHOP_OFFERS, SKILL_GROUPS } from "../data.js";
import { calculateOverallPower } from "../combat/math.js";

const abilityLabels = Object.freeze({
  dynamicProgramming: "动态规划",
  graphTheory: "图论",
  dataStructures: "数据结构",
  mathematics: "数学",
  implementation: "代码实现",
});

const skillCategoryLabels = Object.freeze({ problem: "解题技能", support: "辅助技能" });
const targetRuleLabels = Object.freeze({
  lowestRemaining: "剩余进度最低的题目",
  highestDifficulty: "难度最高的题目",
  bestMatch: "最匹配的题目",
  alignedFirst: "优先处理正对位置的题目",
  lowestEnergy: "精力最低的学生",
  lowestFocus: "专注最低的学生",
  allStudents: "全体学生",
  matchingPosition: "正对位置的学生",
});
const effectTypeLabels = Object.freeze({ energyRestore: "恢复精力", focusGain: "增加专注" });

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const FORMATION_SLOTS = Object.freeze(["A1", "A2", "A3"]);

function skillGroupName(student) {
  return SKILL_GROUPS[student.skillGroupId]?.name ?? student.skillGroupId ?? "未配置";
}

function skillGroupData(student) {
  const group = SKILL_GROUPS[student.skillGroupId];
  const levels = student.skillGroupLevels?.[student.skillGroupId] ?? {};
  return {
    id: student.skillGroupId,
    name: group?.name ?? student.skillGroupId ?? "未配置",
    normal: group?.skills?.normal ?? { name: "未配置", category: "problem" },
    burst: group?.skills?.burst ?? { name: "未配置", category: "problem" },
    levels: { normal: levels.normal ?? 1, burst: levels.burst ?? 1 },
  };
}

function skillEffectDescription(skill) {
  const relatedAbility = abilityLabels[skill.relatedAbility] ?? "总体实力";
  if (skill.effectType && effectTypeLabels[skill.effectType]) {
    const effect = skill.effect ?? {};
    const range = effect.min !== undefined && effect.max !== undefined ? `，范围 ${effect.min}～${effect.max}` : "";
    const focus = skill.focusGain ? `；常规技能专注 +${skill.focusGain}` : "";
    return `${effectTypeLabels[skill.effectType]}：基础 ${effect.base ?? 0} + ${relatedAbility} × ${effect.multiplier ?? 0}${range}${focus}`;
  }
  const focus = skill.focusGain ? `；常规技能专注 +${skill.focusGain}` : "";
  return `推进题目进度（关联${relatedAbility}）：技能倍率 ${skill.skillMultiplier ?? 1}，目标倍率 ${skill.targetMultiplier ?? 1}，固定加成 ${skill.flatBonus ?? 0}${focus}`;
}

function renderSkillDetail(skill, level, timing) {
  const category = skillCategoryLabels[skill.category] ?? "技能";
  const target = targetRuleLabels[skill.targetRule] ?? skill.targetRule ?? "自动选择目标";
  return `<article class="student-detail-skill"><div class="student-detail-skill-head"><div><span class="student-detail-skill-timing">${timing}</span><h3>${esc(skill.name)}</h3></div><strong>Lv.${esc(level)}</strong></div><dl><div><dt>类别</dt><dd>${esc(category)}</dd></div><div><dt>目标</dt><dd>${esc(target)}</dd></div><div><dt>效果</dt><dd>${esc(skillEffectDescription(skill))}</dd></div></dl></article>`;
}

function studentChoice(student, selected) {
  const overallPower = Math.round(calculateOverallPower(student));
  return `<div class="student-choice"><label><input type="checkbox" data-student-toggle value="${esc(student.id)}"${selected ? " checked" : ""}><span><strong>${esc(student.name)}</strong><small>${esc(student.aptitude)} · 技能组：${esc(skillGroupName(student))}</small><small>总体水平 ${overallPower} · 精力 ${esc(student.maxEnergy)}</small></span></label><button type="button" class="secondary-button student-detail-trigger" data-student-detail="${esc(student.id)}">详情</button></div>`;
}

function rosterCard(student, slot) {
  const overallPower = Math.round(calculateOverallPower(student));
  return `<article class="roster-card team-member-card" draggable="true" data-drag-student="${esc(student.id)}" data-drop-position="${esc(slot)}" aria-label="${esc(slot)} ${esc(student.name)}，技能组：${esc(skillGroupName(student))}，可拖动调整站位"><div class="roster-card-head"><span class="roster-slot" aria-hidden="true">${esc(slot)}</span><span class="drag-hint">拖动调整</span></div><div class="student-identity"><div class="student-name-row"><strong>${esc(student.name)}</strong><button type="button" class="secondary-button student-detail-trigger" data-student-detail="${esc(student.id)}">详情</button></div><span>${esc(student.aptitude)}</span><span class="student-skill-group">技能组：${esc(skillGroupName(student))}</span><span class="student-overall">总体水平 ${overallPower}</span><span class="student-max-energy">最大精力 ${esc(student.maxEnergy)}</span></div><dl>${Object.entries(student.abilities).map(([ability, value]) => `<div><dt>${abilityLabels[ability]}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`;
}

export function renderStudentDetail({ student } = {}) {
  if (!student) return "";
  const group = skillGroupData(student);
  return `<div class="student-detail-overlay" data-student-detail-overlay><section class="student-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="student-detail-title"><div class="student-detail-header"><div><p class="eyebrow">学生档案</p><h2 id="student-detail-title">${esc(student.name)}</h2><p class="student-detail-subtitle">${esc(student.aptitude)} · 技能组：${esc(group.name)}</p></div><button type="button" class="icon-button" data-student-detail-close data-action="close-student-detail" aria-label="关闭学生详情" title="关闭学生详情">关闭</button></div><div class="student-detail-summary"><div><span>总体水平</span><strong>${Math.round(calculateOverallPower(student))}</strong></div><div><span>最大精力</span><strong>${esc(student.maxEnergy)}</strong></div><div><span>技能组</span><strong>${esc(group.name)}</strong></div></div><section class="student-detail-section student-detail-rename"><div class="section-heading"><div><p class="eyebrow">身份设置</p><h3>修改名称</h3></div></div><div class="student-name-edit"><label for="student-detail-name">学生名称</label><input id="student-detail-name" data-name-input="${esc(student.id)}" value="${esc(student.name)}" maxlength="12" autocomplete="off"><button type="button" class="primary-button" data-save-name="${esc(student.id)}">保存</button><button type="button" class="secondary-button" data-action="cancel-student-rename">取消</button></div></section><section class="student-detail-section"><div class="section-heading"><div><p class="eyebrow">能力构成</p><h3>五项数值</h3></div></div><dl class="student-detail-abilities">${Object.entries(student.abilities).map(([ability, value]) => `<div><dt>${esc(abilityLabels[ability] ?? ability)}</dt><dd>${esc(value)}</dd><span style="width:${Math.max(0, Math.min(100, Number(value) / 10))}%"></span></div>`).join("")}</dl></section><section class="student-detail-section"><div class="section-heading"><div><p class="eyebrow">个人技能组</p><h3>${esc(group.name)}</h3></div><span class="student-detail-group-id">${esc(group.id)}</span></div><div class="student-detail-skills">${renderSkillDetail(group.normal, group.levels.normal, "常规技能")}${renderSkillDetail(group.burst, group.levels.burst, "爆发技能")}</div></section></section></div>`;
}

export function renderRoster({ profile, formation, teamIds, editing = false, message }) {
  const students = Object.values(profile.students);
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const team = FORMATION_SLOTS.map((slot) => ({ slot, student: studentsById.get(formation?.[slot]) })).filter(({ student }) => student);
  const teamOverallPower = team.reduce((sum, { student }) => sum + Math.round(calculateOverallPower(student)), 0);
  return `<section class="app-view roster-view" aria-labelledby="roster-title"><div class="view-heading"><div><p class="eyebrow">学生名单</p><div class="roster-title-row"><h1 id="roster-title">当前队伍</h1><strong class="roster-overall">总体水平 ${teamOverallPower}</strong></div><p class="view-subtitle">拖动队员卡片调整 A1、A2、A3 站位。</p></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><section class="roster-formation" aria-labelledby="roster-formation-title"><div class="section-heading"><div><p class="eyebrow">出战编队</p><h2 id="roster-formation-title">三人队伍</h2></div><strong class="formation-count">${team.length} / 3</strong></div><div class="roster-grid roster-team-grid">${team.map(({ slot, student }) => rosterCard(student, slot)).join("")}</div><div class="formation-actions"><button type="button" class="secondary-button" data-action="${editing ? "cancel-roster-edit" : "edit-roster"}">${editing ? "取消更换" : "更换队员"}</button><button type="button" class="primary-button" data-action="save-formation">保存编队</button></div></section>${editing ? `<section class="roster-team-editor" aria-labelledby="roster-editor-title"><div class="section-heading"><div><p class="eyebrow">队伍调整</p><h2 id="roster-editor-title">选择参战学生</h2></div><strong class="formation-count${teamIds.length === 3 ? "" : " is-invalid"}">${teamIds.length} / 3</strong></div><fieldset><legend>已拥有学生</legend><div class="student-choices">${students.map((student) => studentChoice(student, teamIds.includes(student.id))).join("")}</div></fieldset></section>` : ""}</section>`;
}

function inventoryRows(inventory) {
  const rows = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  return rows.length ? rows.map(([item, quantity]) => `<li>${esc(item)} <strong>${esc(quantity)}</strong></li>`).join("") : "<li>暂无训练道具</li>";
}

export function renderProgression({ profile, message }) {
  const students = Object.values(profile.students);
  return `<section class="app-view" aria-labelledby="progression-title"><div class="view-heading"><div><p class="eyebrow">训练与补给</p><h1 id="progression-title">进度管理</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="resource-strip"><div><span>训练币</span><strong>${esc(profile.currencies.trainingCoins)}</strong></div><div><span>招募券</span><strong>${esc(profile.currencies.recruitmentTickets)}</strong></div></div><div class="progression-grid"><section class="panel"><h2>专项训练</h2><label>学生<select id="training-student">${students.map((student) => `<option value="${esc(student.id)}">${esc(student.name)}</option>`).join("")}</select></label><label>能力<select id="training-ability">${ABILITY_KEYS.map((ability) => `<option value="${ability}">${abilityLabels[ability]}</option>`).join("")}</select></label><button class="primary-button" type="button" data-action="train">消耗训练册训练</button></section><section class="panel"><h2>补给背包</h2><ul class="inventory-list">${inventoryRows(profile.inventory)}</ul></section></div><section class="shop-section"><div class="section-heading"><div><p class="eyebrow">商店</p><h2>训练补给</h2></div><button class="secondary-button" type="button" data-action="recruit">使用招募券</button></div><div class="shop-grid">${SHOP_OFFERS.map((offer) => `<article class="shop-offer"><strong>${esc(offer.name)}</strong><span>${offer.price.trainingCoins} 训练币</span><button class="secondary-button" type="button" data-buy-offer="${esc(offer.id)}">购买</button></article>`).join("")}</div></section></section>`;
}
