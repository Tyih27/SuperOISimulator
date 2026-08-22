import { renderArena } from "./arena.js";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const MODE_TABS = [
  { id: "arena", label: "竞技场" },
  { id: "boss-rush", label: "BOSS战", description: "限时挑战超大进度条的 Boss 题目，按造成的总进度阶梯结算奖励。" },
];

export function renderModes({ profile, modeTab = "arena", message = "", messageIsError = false, ...arenaProps } = {}) {
  const activeMode = MODE_TABS.find((tab) => tab.id === modeTab) ?? MODE_TABS[0];
  const tabs = MODE_TABS.map((tab) => `<button type="button" class="roster-tab mode-tab${tab.id === activeMode.id ? " is-active" : ""}" aria-pressed="${tab.id === activeMode.id}" data-mode-tab="${esc(tab.id)}">${esc(tab.label)}</button>`).join("");
  const panel = activeMode.description
    ? `<section class="app-view arena-view" aria-labelledby="mode-placeholder-title"><div class="view-heading"><div><p class="eyebrow">玩法</p><h1 id="mode-placeholder-title">${esc(activeMode.label)}</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div><section class="panel"><p class="empty-state">敬请期待：${esc(activeMode.description)}</p></section></section>`
    : renderArena({ profile, ...arenaProps, message, messageIsError });
  return `<div class="roster-tabs mode-tabs" aria-label="玩法标签">${tabs}</div>${panel}`;
}
