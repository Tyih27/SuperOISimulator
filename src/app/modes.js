import { renderArena } from "./arena.js";
import { renderBoss } from "./boss.js";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const MODE_TABS = [
  { id: "arena", label: "竞技场" },
  { id: "boss-rush", label: "BOSS战" },
];

export function renderModes({ profile, modeTab = "arena", message = "", messageIsError = false, arenaProps = {}, bossProps = {} } = {}) {
  const activeMode = MODE_TABS.find((tab) => tab.id === modeTab) ?? MODE_TABS[0];
  const tabs = MODE_TABS.map((tab) => `<button type="button" class="roster-tab mode-tab${tab.id === activeMode.id ? " is-active" : ""}" aria-pressed="${tab.id === activeMode.id}" data-mode-tab="${esc(tab.id)}">${esc(tab.label)}</button>`).join("");
  const panel = activeMode.id === "boss-rush"
    ? renderBoss({ ...bossProps, message, messageIsError })
    : renderArena({ profile, ...arenaProps, message, messageIsError });
  return `<div class="roster-tabs mode-tabs" aria-label="玩法标签">${tabs}</div>${panel}`;
}
