import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const contentTypes = { ".css": "text/css", ".js": "text/javascript", ".html": "text/html", ".json": "application/json" };

createServer((request, response) => {
  const pathname = new URL(request.url, "http://127.0.0.1").pathname;
  const relative = normalize(pathname === "/" ? "index.html" : pathname).replace(/^([.][.][/\\])+/, "");
  const file = join(root, relative);
  if (!existsSync(file) || !statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(response);
}).listen(4173, "127.0.0.1");
