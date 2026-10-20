// Servidor local para probar CB Pilot SIN tocar Netlify: estáticos (public/) + API con base de datos en memoria.
// Uso: ADMIN_SETUP_CODE=codigo-local-123 node tests/servidor-local.mjs [puerto]
// Sin gastar: PILOT_FAKE=1 usa respuestas simuladas (o simplemente: npm run dev). Con ANTHROPIC_API_KEY usa la IA real.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { setStoreFactory, memoryFactory } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setPilotClient } from "../netlify/lib/pilot.mjs";
import { fakeClient } from "./pilot-fake.mjs";
setStoreFactory(memoryFactory());
if (process.env.PILOT_FAKE) setPilotClient(() => fakeClient({ delay: 25 }));
const ROOT = path.resolve(process.argv[3] || "public");
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon", ".pdf": "application/pdf", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks);
    const r = await handler(new Request(url, { method: req.method, headers: req.headers, body }), { ip: req.socket.remoteAddress });
    const h = Object.fromEntries(r.headers); if (h["set-cookie"]) h["set-cookie"] = h["set-cookie"].replace("; Secure", "");
    res.writeHead(r.status, h);
    if (r.body && (h["content-type"] || "").includes("ndjson")) { for await (const chunk of r.body) res.write(chunk); res.end(); return; } // streaming de CB Pilot
    res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  let p = path.join(ROOT, decodeURIComponent(url.pathname));
  try { if ((await stat(p)).isDirectory()) p = path.join(p, "index.html"); const d = await readFile(p); res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" }); res.end(d); }
  catch { res.writeHead(404); res.end("404"); }
}).listen(Number(process.argv[2] || 8899), () => console.log("Servidor local listo"));
