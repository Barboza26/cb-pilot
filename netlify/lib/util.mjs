// Utilidades compartidas: respuestas HTTP, validación, criptografía y límites de solicitudes.
import crypto from "node:crypto";
import { update, getJSON, putJSON } from "./db.mjs";

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
export const fail = (status, code, message) => { throw new HttpError(status, code, message); };

const SEC_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer"
};
export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), { status, headers: { ...SEC_HEADERS, ...headers } });
}
export function errorResponse(e) {
  if (e instanceof HttpError) return json({ ok: false, error: e.code, message: e.message }, e.status);
  if (e && e.status === 409) return json({ ok: false, error: "conflict", message: e.message }, 409);
  console.error("[api] error inesperado", e);
  return json({ ok: false, error: "server_error", message: "Error interno. Intentá de nuevo en unos minutos." }, 500);
}

export async function readJSON(req, max = 64 * 1024) {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > max) fail(413, "too_large", "Solicitud demasiado grande.");
  const text = await req.text();
  if (text.length > max) fail(413, "too_large", "Solicitud demasiado grande.");
  try { return text ? JSON.parse(text) : {}; } catch { fail(400, "bad_json", "JSON inválido."); }
}

// ---------- Validación ----------
export const str = (v, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const isEmail = v => /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/.test(v);
export const isSlug = v => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(v);
export const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ---------- Criptografía ----------
export const randomToken = (bytes = 24) => crypto.randomBytes(bytes).toString("base64url");
export const sha256 = s => crypto.createHash("sha256").update(String(s)).digest("hex");
export function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
export function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}
export function verifyPassword(pw, stored) {
  const [alg, s, k] = String(stored || "").split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = crypto.scryptSync(pw, Buffer.from(s, "base64url"), 64, { N: 16384, r: 8, p: 1 });
  return safeEqual(key.toString("base64url"), k);
}

/** Clave para firmar sesiones: se genera una vez en el servidor y se guarda en el almacén privado. */
export async function serverSecret() {
  const cur = await getJSON("system", "secret");
  if (cur) return cur.data.value;
  const value = randomToken(48);
  await putJSON("system", "secret", { value, createdAt: new Date().toISOString() }, { ifNew: true });
  return (await getJSON("system", "secret")).data.value;
}
export async function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const mac = crypto.createHmac("sha256", await serverSecret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}
export async function verify(token) {
  const [body, mac] = String(token || "").split(".");
  if (!body || !mac) return null;
  const good = crypto.createHmac("sha256", await serverSecret()).update(body).digest("base64url");
  if (!safeEqual(mac, good)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString());
    return p.exp && p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function cookies(req) {
  const out = {};
  for (const part of (req.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function clientIp(req, context) {
  return (context && context.ip) || req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "0.0.0.0";
}

/** Protección CSRF para operaciones con cookie: el Origin debe ser el propio sitio. */
export function sameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return req.method === "GET" || req.method === "HEAD";
  try { return new URL(origin).host === new URL(req.url).host; } catch { return false; }
}

/** Límite de solicitudes por IP y por grupo (ventana fija). Lanza 429 si se supera. */
export async function rateLimit(req, context, bucket, max, windowSec) {
  const win = Math.floor(Date.now() / 1000 / windowSec);
  const key = `${bucket}/${sha256(clientIp(req, context)).slice(0, 32)}/${win}`;
  let count = 0;
  await update("ratelimit", key, cur => { count = (cur?.n || 0) + 1; return { n: count, exp: (win + 1) * windowSec * 1000 }; }, { init: { n: 0 } });
  if (count > max) fail(429, "rate_limited", "Demasiadas solicitudes. Esperá unos minutos e intentá de nuevo.");
}

export const now = () => new Date().toISOString();

/** Cifrado simétrico (AES-256-GCM) con la clave del servidor, para datos que deben poder recuperarse. */
export async function encrypt(text) {
  const key = crypto.createHash("sha256").update("enc:" + await serverSecret()).digest();
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([c.update(String(text), "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString("base64url")).join(".");
}
export async function decrypt(blob) {
  const [iv, tag, data] = String(blob || "").split(".").map(x => Buffer.from(x, "base64url"));
  const key = crypto.createHash("sha256").update("enc:" + await serverSecret()).digest();
  const d = crypto.createDecipheriv("aes-256-gcm", key, iv); d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
