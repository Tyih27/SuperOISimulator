import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/base.css"), "utf8");
const source = fs.readFileSync(path.join(root, "src/app/main.js"), "utf8");
const apiSource = fs.readFileSync(path.join(root, "src/api/client.js"), "utf8");
const authSource = fs.readFileSync(path.join(root, "src/app/auth.js"), "utf8");
const campaignSource = fs.readFileSync(path.join(root, "src/app/campaign.js"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "src/app/router.js"), "utf8");

assert.match(html, /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/);
assert.match(html, /id=["']app["']/);
assert.match(authSource, /<label>用户名<input/);
assert.match(authSource, /<label>密码<input/);
assert.match(authSource, /注册并登录/);
assert.match(authSource, /导出训练数据/);
assert.match(authSource, /请求删除账户/);
assert.match(campaignSource, /data-student-toggle/);
assert.match(campaignSource, /data-position/);
assert.match(campaignSource, /保存编队/);
assert.match(apiSource, /credentials: "same-origin"/);
assert.match(routerSource, /\/campaign\/battles/);
assert.match(css, /button:focus-visible/);
assert.match(css, /@media\s*\(max-width:\s*760px\)/);
assert.match(css, /@media\s*\(max-width:\s*420px\)/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.doesNotMatch(css, /position:\s*fixed;[^}]*width:\s*100vw/);
assert.match(source, /createApiClient/);
assert.match(source, /createRouter/);
assert.match(routerSource, /settle-battle/);
assert.match(routerSource, /\/account\/export/);
assert.doesNotMatch(routerSource, /localStorage/, "durable account and progression state must not use browser storage");

console.log("page accessibility audit passed");
