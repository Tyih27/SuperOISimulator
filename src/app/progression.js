import {
  ABILITY_KEYS,
  APTITUDE_ORDER,
  RECRUITMENT_APTITUDE_WEIGHTS,
  RECRUITMENT_PITY_LIMIT,
  SHOP_OFFERS,
  SKILL_GROUPS,
} from "../data.js";
import { calculateOverallPower } from "../combat/math.js";
import { ENERGY_TONIC_ID, ENERGY_TONIC_MAX_ENERGY_CAP, ENERGY_TONIC_MAX_ENERGY_GAIN, specialistTrainingBookId, STUDENT_TRAINING_MATERIAL_ID } from "../domain/progression.js";

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

function lineupCard(student, slot) {
  const overallPower = Math.round(calculateOverallPower(student));
  const label = slot ? `${slot} ${student.name}` : `替补 ${student.name}`;
  return `<article class="roster-card team-member-card${slot ? "" : " bench-card"}" draggable="true" data-drag-student="${esc(student.id)}"${slot ? ` data-drop-position="${esc(slot)}"` : ""} aria-label="${esc(label)}，技能组：${esc(skillGroupName(student))}，可拖动调整阵容"><div class="roster-card-head"><span class="roster-slot" aria-hidden="true">${slot ? esc(slot) : "替补"}</span><span class="drag-hint">拖动调整</span></div><div class="student-identity"><div class="student-name-row"><strong>${esc(student.name)}</strong><button type="button" class="secondary-button student-detail-trigger" data-student-detail="${esc(student.id)}">详情</button></div><span>${esc(student.aptitude)}</span><span class="student-skill-group">技能组：${esc(skillGroupName(student))}</span><span class="student-overall">总体水平 ${overallPower}</span></div>${slot ? `<button type="button" class="secondary-button" data-bench-student="${esc(student.id)}">换下</button>` : ""}</article>`;
}

export function renderLineupDialog({ profile }) {
  const students = Object.values(profile.students ?? {});
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const starters = FORMATION_SLOTS
    .map((slot) => ({ slot, student: studentsById.get(profile.formation?.[slot]) }))
    .filter(({ student }) => student);
  return `<div class="lineup-overlay" data-lineup-overlay><section class="lineup-dialog" role="dialog" aria-modal="true" aria-labelledby="lineup-title"><div class="lineup-header"><div><p class="eyebrow">调整阵容</p><h2 id="lineup-title">拖拽站位卡片互换位置</h2></div><button type="button" class="icon-button" data-action="close-lineup-editor" aria-label="关闭调整阵容" title="关闭调整阵容">关闭</button></div><p class="view-subtitle">在 A1、A2、A3 之间拖拽卡片即可互换站位；更换出场学生请使用名单页的「替换学生」。修改即时保存。</p><div class="lineup-slots-grid">${starters.map(({ slot, student }) => lineupCard(student, slot)).join("")}</div></section></div>`;
}

function renderReplacePicker(profile, current) {
  const starterIds = new Set(FORMATION_SLOTS.map((slot) => profile.formation?.[slot]).filter(Boolean));
  const bench = Object.values(profile.students ?? {})
    .filter((student) => !starterIds.has(student.id))
    .map((student) => ({ student, power: Math.round(calculateOverallPower(student)) }))
    .sort((a, b) => b.power - a.power || a.student.id.localeCompare(b.student.id));
  if (!bench.length) return "<p class=\"empty-state\">暂无替补学生可供替换。</p>";
  return `<div class="replace-options">${bench.map(({ student, power }) => `<div class="replace-option"><div class="replace-info"><strong>${esc(student.name)}</strong><small>${esc(student.aptitude)} · ${esc(skillGroupName(student))} · 总体水平 ${power}</small></div><div class="replace-actions"><button type="button" class="secondary-button student-detail-trigger" data-student-detail="${esc(student.id)}">详情</button><button type="button" class="primary-button" data-replace-with="${esc(student.id)}" data-replace-target="${esc(current.id)}">替换上场</button></div></div>`).join("")}</div>`;
}

function renderStudentDossier({ profile, student, slot, enhanceOpen = false, replaceOpen = false }) {
  if (!student) return "";
  const group = skillGroupData(student);
  const inFormation = Object.values(profile.formation ?? {}).includes(student.id);
  const dismissible = !inFormation;
  const inventory = profile.inventory ?? {};
  const tonicCount = inventory[ENERGY_TONIC_ID] ?? 0;
  return `<section class="roster-detail-panel" aria-labelledby="roster-dossier-title"><header class="dossier-head"><span class="roster-slot" aria-hidden="true">${esc(slot)}</span><h2 id="roster-dossier-title">${esc(student.name)}</h2><span class="hero-tag">${esc(student.aptitude)}</span><span class="hero-tag hero-tag-skill">技能组：${esc(group.name)}</span></header><dl class="student-page-summary"><div><span>总体水平</span><strong>${Math.round(calculateOverallPower(student))}</strong></div><div><span>最大精力</span><strong>${esc(student.maxEnergy)}</strong></div><div><span>技能组</span><strong>${esc(group.name)}</strong></div><div><span>状态</span><strong>${inFormation ? "上场队员" : "替补"}</strong></div></dl><section class="panel replace-panel" aria-labelledby="replace-title"><div class="panel-header"><div><p class="eyebrow">出场队员</p><h3 id="replace-title">替换学生</h3></div><button type="button" class="secondary-button" data-action="${replaceOpen ? "cancel-replace" : "open-replace"}">${replaceOpen ? "收起" : "替换学生"}</button></div>${replaceOpen ? renderReplacePicker(profile, student) : `<p class="view-subtitle">从替补席选择一名学生替换 ${esc(student.name)} 的站位，替换后立即生效。</p>`}</section><section class="panel enhance-panel" aria-labelledby="enhance-title"><div class="panel-header"><div><p class="eyebrow">学生强化</p><h3 id="enhance-title">提升能力</h3></div><button type="button" class="secondary-button" data-action="${enhanceOpen ? "cancel-enhance" : "open-enhance"}">${enhanceOpen ? "收起" : "提升"}</button></div>${enhanceOpen ? enhanceForm(student, inventory) : "<p class=\"view-subtitle\">使用专项训练册或学生培养材料提升学生的能力数值。</p>"}</section><section class="panel energy-panel" aria-labelledby="energy-title"><div class="panel-header"><div><p class="eyebrow">精力提升</p><h3 id="energy-title">扩充精力上限</h3></div></div><p class="view-subtitle">使用 1 份精力药剂使 ${esc(student.name)} 的最大精力 +${ENERGY_TONIC_MAX_ENERGY_GAIN}，最高可提升至 ${ENERGY_TONIC_MAX_ENERGY_CAP.toLocaleString("en-US")}（当前 ${esc(student.maxEnergy)}，持有 ${esc(tonicCount)} 份）。精力药剂可在「训练与补给」商店购买。</p><button type="button" class="primary-button" data-action="use-energy-tonic" data-student-id="${esc(student.id)}"${tonicCount > 0 && student.maxEnergy < ENERGY_TONIC_MAX_ENERGY_CAP ? "" : " disabled"}>${student.maxEnergy >= ENERGY_TONIC_MAX_ENERGY_CAP ? "已达精力上限" : "使用精力药剂"}</button></section><div class="student-page-actions"><button type="button" class="secondary-button" data-student-detail="${esc(student.id)}">详细信息</button>${dismissible ? `<button type="button" class="secondary-button" data-dismiss-student="${esc(student.id)}">劝退并获得培养材料</button>` : ""}</div></section>`;
}

function enhanceForm(student, inventory) {
  const materialCount = inventory["student-training-material"] ?? 0;
  return `<form class="enhance-form" data-enhance-form data-student-id="${esc(student.id)}"><fieldset><legend>选择要提升的能力</legend><div class="enhance-options">${ABILITY_KEYS.map((ability) => {
    const bookCount = inventory[specialistTrainingBookId(ability)] ?? 0;
    return `<label class="enhance-option"><input type="radio" name="enhance-ability" value="${esc(ability)}" required><span><strong>${abilityLabels[ability]}</strong><small>${abilityLabels[ability]}专项训练册 ×${esc(bookCount)}</small></span></label>`;
  }).join("")}</div></fieldset><p class="view-subtitle">优先消耗对应专项训练册，使用训练册强化免费；没有训练册时自动消耗 1 份学生培养材料和 100 训练币（当前持有 ${esc(materialCount)} 份材料）。</p><button type="submit" class="primary-button">确认提升</button></form>`;
}

function renderStudentName(student, editingName) {
  if (!editingName) {
    return `<div class="student-detail-name-row"><h2 id="student-detail-title">${esc(student.name)}</h2><button type="button" class="secondary-button" data-action="edit-student-name">修改名字</button></div>`;
  }
  return `<div class="student-detail-name-editor"><label for="student-detail-name">学生名称</label><input id="student-detail-name" data-name-input="${esc(student.id)}" value="${esc(student.name)}" maxlength="12" autocomplete="off"><button type="button" class="primary-button" data-save-name="${esc(student.id)}">保存</button><button type="button" class="secondary-button" data-action="cancel-student-rename">取消</button></div>`;
}

export function renderStudentDetail({ student, editingName = false, dismissible = false } = {}) {
  if (!student) return "";
  const group = skillGroupData(student);
  const dialogLabel = editingName ? `aria-label="${esc(`学生详情：${student.name}`)}"` : `aria-labelledby="student-detail-title"`;
  const dismissalAction = dismissible
    ? `<button type="button" class="secondary-button" data-dismiss-student="${esc(student.id)}">劝退并获得培养材料</button>`
    : "";
  return `<div class="student-detail-overlay" data-student-detail-overlay><section class="student-detail-dialog" role="dialog" aria-modal="true" ${dialogLabel}><div class="student-detail-header"><div><p class="eyebrow">学生档案</p>${renderStudentName(student, editingName)}<p class="student-detail-subtitle">${esc(student.aptitude)} · 技能组：${esc(group.name)}</p></div><div class="student-detail-actions">${dismissalAction}<button type="button" class="icon-button" data-student-detail-close data-action="close-student-detail" aria-label="关闭学生详情" title="关闭学生详情">关闭</button></div></div><div class="student-detail-summary"><div><span>总体水平</span><strong>${Math.round(calculateOverallPower(student))}</strong></div><div><span>最大精力</span><strong>${esc(student.maxEnergy)}</strong></div><div><span>技能组</span><strong>${esc(group.name)}</strong></div></div><section class="student-detail-section"><div class="section-heading"><div><p class="eyebrow">能力构成</p><h3>五项数值</h3></div></div><dl class="student-detail-abilities">${Object.entries(student.abilities).map(([ability, value]) => `<div><dt>${esc(abilityLabels[ability] ?? ability)}</dt><dd>${esc(value)}</dd><span style="width:${Math.max(0, Math.min(100, Number(value) / 10))}%"></span></div>`).join("")}</dl></section><section class="student-detail-section"><div class="section-heading"><div><p class="eyebrow">个人技能组</p><h3>${esc(group.name)}</h3></div><span class="student-detail-group-id">${esc(group.id)}</span></div><div class="student-detail-skills">${renderSkillDetail(group.normal, group.levels.normal, "常规技能")}${renderSkillDetail(group.burst, group.levels.burst, "爆发技能")}</div></section></section></div>`;
}

export function renderRoster({ profile, selectedId, enhanceOpen = false, replaceOpen = false, dismissOpen = false, dismissSelected = [], dismissConfirmPending = false, message, messageIsError = false }) {
  const students = Object.values(profile.students ?? {});
  const studentsById = new Map(students.map((student) => [student.id, student]));
  const team = FORMATION_SLOTS
    .map((slot) => ({ slot, student: studentsById.get(profile.formation?.[slot]) }))
    .filter(({ student }) => student);
  const selected = team.find(({ student }) => student.id === selectedId) ?? team[0];
  const teamOverallPower = team.reduce((sum, { student }) => sum + Math.round(calculateOverallPower(student)), 0);
  const teamIds = new Set(team.map(({ student }) => student.id));
  const bench = students
    .filter((student) => !teamIds.has(student.id))
    .map((student) => ({ student, power: Math.round(calculateOverallPower(student)) }))
    .sort((a, b) => b.power - a.power || a.student.id.localeCompare(b.student.id));
  const dismissList = bench.map(({ student, power }) => {
    const isSelected = dismissSelected.includes(student.id);
    return `<button type="button" class="dismiss-tile${isSelected ? " is-selected" : ""}" role="checkbox" aria-checked="${isSelected}" data-toggle-dismiss="${esc(student.id)}"><span class="dismiss-toggle" aria-hidden="true">${isSelected ? "✓" : ""}</span><strong>${esc(student.name)}</strong><span>${esc(student.aptitude)} · ${esc(skillGroupName(student))}</span><span>总体水平 ${power}</span></button>`;
  }).join("");
  const benchAptitudes = APTITUDE_ORDER
    .map((aptitude) => ({ aptitude, students: bench.filter(({ student }) => student.aptitude === aptitude) }))
    .filter(({ students: group }) => group.length > 0);
  const allBenchSelected = bench.length > 0 && bench.every(({ student }) => dismissSelected.includes(student.id));
  const dismissToolbar = `<div class="dismiss-toolbar"><button type="button" class="secondary-button" data-action="toggle-dismiss-all">${allBenchSelected ? "全不选" : "全选全部替补"}</button><span>共 ${bench.length} 名替补</span></div>`;
  const dismissStats = benchAptitudes.map(({ aptitude, students: group }) => {
    const allSelected = group.every(({ student }) => dismissSelected.includes(student.id));
    const selectedCount = group.filter(({ student }) => dismissSelected.includes(student.id)).length;
    return `<button type="button" class="dismiss-stat-chip${allSelected ? " is-active" : ""}" data-toggle-dismiss-aptitude="${esc(aptitude)}"><strong>${esc(aptitude)} × ${group.length}</strong><span>${group.length ? (allSelected ? "取消全选" : "全选") : ""}${selectedCount && !allSelected ? `（已选 ${selectedCount}）` : ""}</span></button>`;
  }).join("");
  const rareCount = dismissSelected
    .map((id) => studentsById.get(id)?.aptitude)
    .filter((aptitude) => aptitude && APTITUDE_ORDER.indexOf(aptitude) >= APTITUDE_ORDER.indexOf("稀有"))
    .length;
  const dismissFooter = `<footer class="dismiss-footer"><span>已选 ${dismissSelected.length} 名，预计获得 ${dismissSelected.length} 份学生培养材料${rareCount ? `，其中 ${rareCount} 名为稀有及以上` : ""}</span><span class="dismiss-footer-actions"><button type="button" class="secondary-button" data-action="clear-dismiss-selection"${dismissSelected.length ? "" : " disabled"}>清空选择</button><button type="button" class="primary-button" data-action="confirm-dismiss-selected"${dismissSelected.length ? "" : " disabled"}>${dismissConfirmPending ? "确认劝退" : "劝退选中"}</button></span></footer>`;
  return `<section class="app-view roster-view" aria-labelledby="roster-title"><div class="view-heading"><div class="roster-heading"><p class="eyebrow">学生名单</p><div class="roster-title-row"><h1 id="roster-title">当前队伍</h1><strong class="roster-overall">总体水平 ${teamOverallPower}</strong></div></div><button type="button" class="primary-button" data-action="open-lineup-editor">调整阵容</button><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div>${team.length ? `<div class="roster-tabs" aria-label="上场队员">${team.map(({ slot, student }) => `<button type="button" class="roster-tab${selected.student.id === student.id ? " is-active" : ""}" aria-pressed="${selected.student.id === student.id}" data-select-roster-student="${esc(student.id)}"><span class="roster-slot" aria-hidden="true">${esc(slot)}</span>${esc(student.name)}</button>`).join("")}</div>${renderStudentDossier({ profile, student: selected.student, slot: selected.slot, enhanceOpen, replaceOpen })}` : `<p class="empty-state">尚未安排上场队员，请点击「调整阵容」。</p>`}${bench.length ? `<section class="bench-strip" aria-labelledby="bench-strip-title"><div class="bench-header"><h2 id="bench-strip-title">替补席</h2><button type="button" class="secondary-button" data-action="${dismissOpen ? "close-dismiss-panel" : "open-dismiss-panel"}">${dismissOpen ? "收起劝退列表" : "批量劝退"}</button></div>${dismissOpen ? `${rareCount && dismissConfirmPending ? `<p class="app-message--error" role="alert">所选包含稀有及以上资质学生，请再次点击「确认劝退」完成操作。</p>` : ""}${dismissToolbar}<div class="dismiss-stats" role="group" aria-label="按资质统计与全选">${dismissStats}</div><div class="dismiss-options" role="group" aria-label="选择要劝退的替补学生">${dismissList}</div>${dismissFooter}` : ""}<div class="bench-pills">${bench.map(({ student }) => `<button type="button" class="bench-pill" data-student-detail="${esc(student.id)}" aria-label="查看 ${esc(student.name)} 详情"><strong>${esc(student.name)}</strong><span>${esc(student.aptitude)} · ${esc(skillGroupName(student))}</span></button>`).join("")}</div></section>` : ""}</section>`;
}

function inventoryRows(inventory) {
  const rows = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  const labels = {
    [STUDENT_TRAINING_MATERIAL_ID]: "学生培养材料",
    [ENERGY_TONIC_ID]: "精力药剂",
    ...Object.fromEntries(ABILITY_KEYS.map((ability) => [specialistTrainingBookId(ability), `${abilityLabels[ability]}专项训练册`])),
  };
  return rows.length ? rows.map(([item, quantity]) => `<li>${esc(labels[item] ?? item)} <strong>${esc(quantity)}</strong></li>`).join("") : "<li>暂无训练道具</li>";
}

export function renderProgression({ profile, message, messageIsError = false }) {
  const pityCount = profile.recruitment?.attemptsSinceGenius ?? 0;
  const pityRemaining = Math.max(0, RECRUITMENT_PITY_LIMIT - pityCount);
  const rates = Object.entries(RECRUITMENT_APTITUDE_WEIGHTS)
    .map(([aptitude, probability]) => `<span>${esc(aptitude)} ${Math.round(probability * 1000) / 10}%</span>`)
    .join("");
  return `<section class="app-view" aria-labelledby="progression-title"><div class="view-heading"><div><p class="eyebrow">训练与补给</p><h1 id="progression-title">进度管理</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><div class="resource-strip"><div><span>训练币</span><strong>${esc(profile.currencies.trainingCoins)}</strong></div><div><span>招募券</span><strong>${esc(profile.currencies.recruitmentTickets)}</strong></div><div><span>天才保底</span><strong>${esc(pityCount)} / ${RECRUITMENT_PITY_LIMIT}</strong><small>还需 ${esc(pityRemaining)} 次</small></div></div><div class="progression-grid"><section class="panel"><h2>每日签到</h2><p class="view-subtitle">每日可领取 1,000 训练币</p><button class="primary-button" type="button" data-action="daily-check-in">领取今日奖励</button></section><section class="panel"><h2>学生强化</h2><p class="view-subtitle">请前往「学生名单」选择学生，在其档案页使用道具提升能力。</p><a class="secondary-button" href="#roster">前往学生名单</a></section><section class="panel"><h2>补给背包</h2><ul class="inventory-list">${inventoryRows(profile.inventory)}</ul></section></div><section class="shop-section"><div class="section-heading"><div><p class="eyebrow">商店</p><h2>训练补给</h2><p class="view-subtitle">资质概率：${rates}</p></div><button class="secondary-button" type="button" data-action="recruit">使用招募券</button></div><div class="shop-grid">${SHOP_OFFERS.map((offer) => `<article class="shop-offer"><strong>${esc(offer.name)}</strong><span>${offer.price.trainingCoins} 训练币</span><button class="secondary-button" type="button" data-buy-offer="${esc(offer.id)}">购买</button></article>`).join("")}</div></section></section>`;
}
