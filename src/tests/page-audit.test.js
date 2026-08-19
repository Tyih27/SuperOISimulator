import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles/base.css"), "utf8");
const source = fs.readFileSync(path.join(root, "src/app/main.js"), "utf8");

assert.match(html, /<meta\s+name=["']viewport["'][^>]*content=["'][^"']*width=device-width/);
assert.match(html, /class=["'][^"']*skip-link/);
for (const id of ["start-button", "pause-button", "step-button", "restart-top", "restart-result"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `${id} must exist`);
}
for (const studentId of ["planner", "graphist", "structurer", "mathematician", "implementer", "supporter"]) {
  assert.match(html, new RegExp(`<label[^>]*for=["']roster-${studentId}["']`), `${studentId} roster checkbox must have a label`);
  assert.match(html, new RegExp(`id=["']roster-${studentId}["'][^>]*type=["']checkbox["']`), `${studentId} roster checkbox must exist`);
}
for (const slot of ["a1", "a2", "a3"]) {
  assert.match(html, new RegExp(`<label[^>]*for=["']formation-${slot}["']`), `${slot.toUpperCase()} selector must have a label`);
  assert.match(html, new RegExp(`<select[^>]*id=["']formation-${slot}["']`), `${slot.toUpperCase()} selector must exist`);
}
assert.match(html, /id=["']formation-count["'][^>]*>3 \/ 3</);
assert.match(html, /id=["']confirm-formation["']/);
assert.match(html, /id=["']pause-button["'][^>]*disabled/);
assert.match(html, /aria-label=["']播放控制["']/);
assert.match(css, /button:focus-visible/);
assert.match(css, /@media\s*\(max-width:\s*760px\)/);
assert.match(css, /@media\s*\(max-width:\s*420px\)/);
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
assert.doesNotMatch(css, /position:\s*fixed;[^}]*width:\s*100vw/);
assert.match(source, /SKILL_GROUPS/, "the page must read the skill-group catalogue");
assert.match(source, /skillGroupId/, "student skills must resolve from the student's selected group");
assert.match(source, /topic\.skill/, "topic cards and actions must resolve a configured topic skill");
assert.match(source, /action\.skillName/, "action rendering must use the emitted skill name");
assert.match(source, /action\?\.category/, "action rendering must distinguish configured skill categories");
assert.doesNotMatch(source, /data\.skills\[/, "skills must not be selected from a position's student data");

console.log("page accessibility audit passed");
