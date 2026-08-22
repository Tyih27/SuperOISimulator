function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderBoss({ battlesToday = null, dailyLimit = null, history = [], message = "", messageIsError = false } = {}) {
  const exhausted = dailyLimit !== null && (battlesToday ?? 0) >= dailyLimit;
  const quotaText = dailyLimit === null ? "" : `<span class="panel-meta">今日剩余挑战次数 ${Math.max(dailyLimit - (battlesToday ?? 0), 0)} / ${esc(dailyLimit)}</span>`;
  return `<section class="app-view boss-view" aria-labelledby="boss-title">
    <div class="view-heading"><div><p class="eyebrow">BOSS战</p><h1 id="boss-title">无限试炼</h1></div><p class="app-message${messageIsError ? " app-message--error" : ""}" role="status" aria-live="polite">${esc(message)}</p></div>
    <section class="panel"><div class="panel-header"><h2>挑战 BOSS</h2>${quotaText}</div>
      <p class="arena-copy">使用当前上场编队迎战一个无法被击败的巨型题目，固定 30 回合。按累计造成的伤害结算训练币（每 200 点伤害兑换 1 枚），中途全灭也保留已造成的伤害。辅助型学生可以延长队伍的生存时间。</p>
      <button class="primary-button" type="button" data-action="start-boss-challenge"${exhausted ? " disabled" : ""}>开始挑战</button>
${exhausted ? `<p class="arena-copy">今日挑战次数已用完，请明天再战。</p>` : ""}
    </section>
    <section class="panel"><div class="panel-header"><h2>挑战历史</h2><button class="secondary-button" type="button" data-action="load-boss-history">刷新</button></div>${history.length ? `<ol class="event-replay">${history.map((item) => `<li><span>${esc(item.status === "settled" ? "已结算" : "进行中")}</span>伤害 ${esc(item.damage ?? "-")} · ${item.status === "settled" ? `${esc(item.rewardCoins ?? 0)} 训练币` : "待结算"}</li>`).join("")}</ol>` : `<p class="empty-state">暂无 BOSS 挑战记录。</p>`}</section>
  </section>`;
}
