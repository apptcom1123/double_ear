import { createReadStream } from "node:fs";
import { stat, readdir } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT || 4993);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".md": "text/markdown; charset=utf-8"
};

createServer(async (request, response) => {
  if (request.url === "/api/radio") {
    try {
      const names = await readdir(join(root, "assets/radio"));
      const tracks = names.filter(name => /\.(mp3|wav|ogg)$/i.test(name)).sort().map(name => ({
        name: name.replace(/^OldRadio_Adv--/, "").replace(/\.[^.]+$/, "").replaceAll("_", " "),
        url: `/assets/radio/${encodeURIComponent(name)}`
      }));
      response.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(tracks));
    } catch { response.writeHead(500).end("Radio library unavailable"); }
    return;
  }
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  const relative = normalize(pathname === "/" ? "index.html" : pathname.slice(1));
  const file = join(root, relative);
  if (!file.startsWith(root) || relative.startsWith("..")) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`Double Ear: http://127.0.0.1:${port}`);
});
