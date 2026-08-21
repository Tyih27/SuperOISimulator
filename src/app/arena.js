import { SKILL_GROUPS } from "../data.js";
import { EVENT_LABELS } from "./event-labels.js";

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function skillGroupName(student) {
  return SKILL_GROUPS[student?.skillGroupId]?.name ?? student?.skillGroupId ?? "未配置";
}

export function renderArena({ profile, defense, opponents = [], history = [], match, replay, liveHtml = "", battlesToday = null, dailyLimit = null, message = "", messageIsError = false } = {}) {
  const formation = profile?.formation ?? {};
  const students = Object.values(profile?.students ?? {});
  const quotaExhausted = dailyLimit !== null && (battlesToday ?? 0) >= dailyLimit;
  const quotaText = dailyLimit === null ? "" : `<span class="panel-meta">今日剩余挑战次数 ${Math.max(dailyLimit - (battlesToday ?? 0), 0)} / ${esc(dailyLimit)}</span>`;
  return `<section class="app-view arena-view" aria-labelledby="arena-title">
    <div class="view-heading"><div><p class="eyebrow">异步竞技场</p><h1 id="arena-title">镜像挑战</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div>
    <div class="arena-grid">
      <section class="panel"><div class="panel-header"><h2>防守编队</h2><span class="panel-meta">积分 ${esc(defense?.rating ?? 1000)}</span></div>
        <p class="arena-copy">服务器保存三名学生的能力、技能组和站位快照，进攻时不会读取对手当前档案。</p>
        <ol class="arena-formation">${["A1", "A2", "A3"].map((slot) => { const student = students.find((item) => item.id === formation[slot]); return `<li><span>${slot}</span><div><strong>${esc(student?.name ?? formation[slot] ?? "未设置")}</strong>${student ? `<small>技能组：${esc(skillGroupName(student))}</small>` : ""}</div></li>`; }).join("")}</ol>
        <button class="primary-button" type="button" data-action="save-arena-defense">保存当前编队</button>
      </section>
      <section class="panel"><div class="panel-header"><h2>可挑战对手</h2>${quotaText}<button class="secondary-button" type="button" data-action="load-arena-opponents">刷新列表</button></div>
        ${opponents.length ? `<div class="opponent-list">${opponents.map((opponent) => `<article class="opponent-row"><div><strong>${esc(opponent.username ?? `对手 ${opponent.accountId.slice(0, 8)}`)}</strong><span>战力 ${esc(opponent.power ?? "未知")} · 积分 ${esc(opponent.rating)} · 胜 ${esc(opponent.battlesWon)} / 负 ${esc(opponent.battlesLost)}</span></div><button class="primary-button" type="button" data-opponent-id="${esc(opponent.accountId)}"${quotaExhausted ? " disabled" : ""}>挑战</button></article>`).join("")}</div>` : `<p class="empty-state">${defense ? "当前暂无可挑战的其他玩家。" : "请先保存防守编队，再刷新对手列表。"}</p>`}
${quotaExhausted ? `<p class="arena-copy">今日挑战次数已用完，请明天再战。</p>` : ""}
      </section>
    </div>
    <section class="panel"><div class="panel-header"><h2>比赛历史</h2><button class="secondary-button" type="button" data-action="load-arena-history">刷新</button></div>${history.length ? `<ol class="event-replay">${history.map((item) => `<li><span>${esc(item.status === "settled" ? "已结算" : "进行中")}</span>${esc(item.id)} · ${esc(item.result?.winner === "attacker" ? "胜利" : item.result?.winner === "defender" ? "失败" : item.status === "settled" ? "平局" : "待结算")}</li>`).join("")}</ol>` : `<p class="empty-state">暂无竞技场比赛记录。</p>`}</section>
    ${match ? `<section class="panel arena-match"><div class="panel-header"><h2>比赛 ${esc(match.id)}</h2><span class="panel-meta">种子 ${esc(match.seed)}</span></div>${replay ? `<div class="settled-result ${replay.result.winner === "attacker" ? "is-win" : replay.result.winner === "draw" ? "is-draw" : "is-lose"}"><h2>${replay.result.winner === "attacker" ? "挑战胜利" : replay.result.winner === "defender" ? "挑战失败" : "平局"}</h2><p>积分 ${esc(replay.rating.attackerBefore)} → ${esc(replay.rating.attackerAfter)}</p>${replay.reward?.trainingCoins ? `<p>获得 ${esc(replay.reward.trainingCoins)} 训练币。</p>` : ""}</div><details open><summary>只读战斗回放</summary><ol class="event-replay">${(replay.events?.attacker ?? []).map((event) => `<li><span>${esc(event.round ?? "准备")}</span>${esc(EVENT_LABELS[event.type] ?? event.type)}</li>`).join("")}</ol></details>` : `${liveHtml}<p class="arena-copy">双方快照已经锁定。观看上方对战过程后，点击按钮进行服务端结算。</p><button class="primary-button" type="button" data-action="settle-arena">开始结算并查看结果</button>`}</section>` : ""}
  </section>`;
}
