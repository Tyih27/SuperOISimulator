export function renderAuthScreen({ message = "" } = {}) {
  return `<main class="auth-page" id="main-content">
    <section class="auth-panel" aria-labelledby="auth-title">
      <p class="eyebrow">SUPER OI SIMULATOR</p>
      <h1 id="auth-title">训练档案</h1>
      <p class="auth-intro">登录后继续主线训练、管理学生并保留所有结算记录。</p>
      <p class="app-message" role="status" aria-live="polite">${message}</p>
      <form data-auth-form class="auth-form">
        <label>用户名<input name="username" autocomplete="username" required pattern="[A-Za-z0-9_]{3,24}" minlength="3" maxlength="24"></label>
        <label>密码<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="1024"></label>
        <div class="auth-actions">
          <button class="primary-button" name="mode" value="login" type="submit">登录</button>
          <button class="secondary-button" name="mode" value="register" type="submit">注册并登录</button>
        </div>
      </form>
    </section>
  </main>`;
}

function esc(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

export function renderAccountScreen({ account, message = "" } = {}) {
  return `<section class="app-view account-view" aria-labelledby="account-title"><div class="view-heading"><div><p class="eyebrow">账户与数据</p><h1 id="account-title">账户管理</h1></div><p class="app-message" role="status" aria-live="polite">${esc(message)}</p></div><div class="account-control-grid"><section class="account-control-section" aria-labelledby="export-title"><div><h2 id="export-title">导出训练数据</h2><p>下载当前档案、进度、战斗记录和操作审计。</p></div><button class="secondary-button" type="button" data-action="export-account">下载 JSON</button></section><section class="account-control-section" aria-labelledby="password-title"><div><h2 id="password-title">更新密码</h2><p>修改后，所有已登录设备都需要使用新密码重新登录。</p></div><form data-account-form="password-change" class="account-form"><label>当前密码<input name="currentPassword" type="password" autocomplete="current-password" required minlength="8" maxlength="1024"></label><label>新密码<input name="newPassword" type="password" autocomplete="new-password" required minlength="8" maxlength="1024"></label><button class="primary-button" type="submit">更新密码</button></form></section><section class="account-control-section danger-section" aria-labelledby="deletion-title"><div><h2 id="deletion-title">请求删除账户</h2><p>账户会立刻退出登录，并在保留期结束后由运维流程处理删除。</p></div><form data-account-form="account-deletion" class="account-form"><label>账户密码<input name="password" type="password" autocomplete="current-password" required minlength="8" maxlength="1024"></label><label class="confirmation-label"><input name="confirmed" type="checkbox" required>我理解此操作会请求删除我的账户</label><button class="danger-button" type="submit">请求删除账户</button></form></section></div></section>`;
}

export function createAuthSession(client) {
  return Object.freeze({
    restore: () => client.get("/auth/session"),
    login: (credentials) => client.post("/auth/login", credentials),
    register: (credentials) => client.post("/auth/register", credentials),
    logout: () => client.post("/auth/logout"),
  });
}
