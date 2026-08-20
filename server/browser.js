import { spawn } from "node:child_process";

function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value.trim() === "") return fallback;
  if (value.trim().toLowerCase() === "true") return true;
  if (value.trim().toLowerCase() === "false") return false;
  throw new Error("OPEN_BROWSER must be true or false");
}

export function shouldOpenBrowser(value, { environment = "development", ci = false } = {}) {
  return parseBoolean(value, environment !== "production" && !ci);
}

function browserCommand(platform, url) {
  if (platform === "darwin") return { command: "open", args: [url] };
  if (platform === "win32") return { command: "cmd", args: ["/c", "start", "", url] };
  return { command: "xdg-open", args: [url] };
}

export function openBrowser(url, { platform = process.platform, spawnImpl = spawn } = {}) {
  const { command, args } = browserCommand(platform, url);
  const child = spawnImpl(command, args, { detached: true, stdio: "ignore" });
  child.once?.("error", (error) => {
    console.warn(`Unable to open browser automatically: ${error.message}`);
  });
  child.unref?.();
  return child;
}
