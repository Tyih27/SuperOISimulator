import { ABILITY_KEYS, SHOP_OFFERS } from "../data.js";

const abilityLabels = Object.freeze({
  dynamicProgramming: "动态规划",
  graphTheory: "图论",
  dataStructures: "数据结构",
  mathematics: "数学",
  implementation: "代码实现",
});

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderRoster({ profile, message }) {
  return `<section class="app-view" aria-labelledby="roster-title"><div class="view-heading"><div><p class="eyebrow">学生名单</p><h1 id="roster-title">我的学生</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="roster-grid">${Object.values(profile.students).map((student) => `<article class="roster-card"><div><strong>${esc(student.name)}</strong><span>${esc(student.aptitude)} · ${esc(student.id)}</span></div><label>显示名称<input data-name-input="${esc(student.id)}" value="${esc(student.name)}" maxlength="12"></label><button type="button" class="secondary-button" data-save-name="${esc(student.id)}">保存名称</button><dl>${Object.entries(student.abilities).map(([ability, value]) => `<div><dt>${abilityLabels[ability]}</dt><dd>${esc(value)}</dd></div>`).join("")}</dl></article>`).join("")}</div></section>`;
}

function inventoryRows(inventory) {
  const rows = Object.entries(inventory).filter(([, quantity]) => quantity > 0);
  return rows.length ? rows.map(([item, quantity]) => `<li>${esc(item)} <strong>${esc(quantity)}</strong></li>`).join("") : "<li>暂无训练道具</li>";
}

export function renderProgression({ profile, message }) {
  const students = Object.values(profile.students);
  return `<section class="app-view" aria-labelledby="progression-title"><div class="view-heading"><div><p class="eyebrow">训练与补给</p><h1 id="progression-title">进度管理</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="resource-strip"><div><span>训练币</span><strong>${esc(profile.currencies.trainingCoins)}</strong></div><div><span>招募券</span><strong>${esc(profile.currencies.recruitmentTickets)}</strong></div></div><div class="progression-grid"><section class="panel"><h2>专项训练</h2><label>学生<select id="training-student">${students.map((student) => `<option value="${esc(student.id)}">${esc(student.name)}</option>`).join("")}</select></label><label>能力<select id="training-ability">${ABILITY_KEYS.map((ability) => `<option value="${ability}">${abilityLabels[ability]}</option>`).join("")}</select></label><button class="primary-button" type="button" data-action="train">消耗训练册训练</button></section><section class="panel"><h2>补给背包</h2><ul class="inventory-list">${inventoryRows(profile.inventory)}</ul></section></div><section class="shop-section"><div class="section-heading"><div><p class="eyebrow">商店</p><h2>训练补给</h2></div><button class="secondary-button" type="button" data-action="recruit">使用招募券</button></div><div class="shop-grid">${SHOP_OFFERS.map((offer) => `<article class="shop-offer"><strong>${esc(offer.name)}</strong><span>${offer.price.trainingCoins} 训练币</span><button class="secondary-button" type="button" data-buy-offer="${esc(offer.id)}">购买</button></article>`).join("")}</div></section></section>`;
}
