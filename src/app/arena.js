import { SKILL_GROUPS } from "../data.js";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function skillGroupName(student) {
  return SKILL_GROUPS[student?.skillGroupId]?.name ?? student?.skillGroupId ?? "未配置";
}

export function renderArena({ profile, defense, opponents = [], match, replay, message = "" } = {}) {
  const formation = profile?.formation ?? {};
  const students = Object.values(profile?.students ?? {});
  return `<section class="app-view arena-view" aria-labelledby="arena-title">
    <div class="view-heading"><div><p class="eyebrow">异步竞技场</p><h1 id="arena-title">镜像挑战</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div>
    <div class="arena-grid">
      <section class="panel"><div class="panel-header"><h2>防守编队</h2><span class="panel-meta">积分 ${esc(defense?.rating ?? 1000)}</span></div>
        <p class="arena-copy">服务器保存三名学生的能力、技能组和站位快照，进攻时不会读取对手当前档案。</p>
        <ol class="arena-formation">${["A1", "A2", "A3"].map((slot) => { const student = students.find((item) => item.id === formation[slot]); return `<li><span>${slot}</span><div><strong>${esc(student?.name ?? formation[slot] ?? "未设置")}</strong>${student ? `<small>技能组：${esc(skillGroupName(student))}</small>` : ""}</div></li>`; }).join("")}</ol>
        <button class="primary-button" type="button" data-action="save-arena-defense">保存当前编队</button>
      </section>
      <section class="panel"><div class="panel-header"><h2>可挑战对手</h2><button class="secondary-button" type="button" data-action="load-arena-opponents">刷新列表</button></div>
        ${opponents.length ? `<div class="opponent-list">${opponents.map((opponent) => `<article class="opponent-row"><div><strong>对手 ${esc(opponent.accountId.slice(0, 8))}</strong><span>积分 ${esc(opponent.rating)} · 胜 ${esc(opponent.battlesWon)} / 负 ${esc(opponent.battlesLost)}</span></div><button class="primary-button" type="button" data-opponent-id="${esc(opponent.accountId)}">挑战</button></article>`).join("")}</div>` : `<p class="empty-state">保存防守编队后刷新对手列表。</p>`}
      </section>
    </div>
    ${match ? `<section class="panel arena-match"><div class="panel-header"><h2>比赛 ${esc(match.id)}</h2><span class="panel-meta">种子 ${esc(match.seed)}</span></div>${replay ? `<div class="settled-result ${replay.result.winner === "attacker" ? "is-win" : "is-lose"}"><h2>${replay.result.winner === "attacker" ? "挑战胜利" : replay.result.winner === "defender" ? "挑战失败" : "平局"}</h2><p>积分 ${esc(replay.rating.attackerBefore)} → ${esc(replay.rating.attackerAfter)}</p>${replay.reward?.trainingCoins ? `<p>获得 ${esc(replay.reward.trainingCoins)} 训练币。</p>` : ""}</div><details open><summary>只读战斗回放</summary><ol class="event-replay">${(replay.events?.attacker ?? []).map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(event.type)}</li>`).join("")}</ol></details>` : `<p class="arena-copy">双方快照已经锁定，可以开始服务器回放。</p><button class="primary-button" type="button" data-action="settle-arena">开始回放并结算</button>`}</section>` : ""}
  </section>`;
}
