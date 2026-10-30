// Pruebas de la API de CeBe Pilot con base de datos en memoria y una IA simulada (no gasta dinero ni usa internet).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setStoreFactory, memoryFactory, putJSON } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setPilotClient, savePilotConfig, DEFAULT_CONFIG } from "../netlify/lib/pilot.mjs";
import { fakeClient } from "./pilot-fake.mjs";

const ORIGIN = "https://cebe.test";
let cookie = "", fake;

async function call(method, path, body, { ip = "10.1.0.1", origin = true, auth = false } = {}) {
  const h = { "content-type": "application/json" };
  if (origin) h.origin = ORIGIN;
  if (auth) h.cookie = cookie;
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("ndjson")) {
    const events = (await res.text()).split("\n").filter(Boolean).map(l => JSON.parse(l));
    return { status: res.status, events, text: events.filter(e => e.t === "d").map(e => e.v).join(""), done: events.find(e => e.t === "done") };
  }
  return { status: res.status, data: await res.json() };
}
const user = content => ({ messages: [{ role: "user", content }] });
const month = () => new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 7);

before(async () => {
  setStoreFactory(memoryFactory());
  process.env.ADMIN_SETUP_CODE = "codigo-de-prueba-123";
  delete process.env.ANTHROPIC_API_KEY;
  await call("POST", "/api/admin/setup", { code: "codigo-de-prueba-123", email: "dueno@example.com", password: "contraseña-larga-1" });
  const r = await handler(new Request(ORIGIN + "/api/admin/login", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ email: "dueno@example.com", password: "contraseña-larga-1" }) }), { ip: "10.9.9.9" });
  cookie = r.headers.get("set-cookie").split(";")[0];
});

test("salud y rutas desconocidas", async () => {
  const h = await call("GET", "/api/health");
  assert.equal(h.status, 200);
  assert.equal(h.data.ai, false);
  assert.equal((await call("GET", "/api/nada")).status, 404);
});

test("sin ANTHROPIC_API_KEY, CeBe Pilot avisa que no está activado y no cobra mensajes", async () => {
  const s = await call("POST", "/api/pilot/status", {});
  assert.equal(s.status, 200);
  assert.equal(s.data.plan, "gratis");
  assert.equal(s.data.available, false);
  assert.match(s.data.whatsapp, /^\d{8,15}$/);
  const r = await call("POST", "/api/pilot/chat", user("hola"));
  assert.equal(r.status, 503);
  assert.equal(r.data.error, "pilot_off");
  assert.equal((await call("POST", "/api/pilot/status", {})).data.usedToday, 0);
});

test("responde en streaming con el modelo del plan gratis y descuenta un mensaje", async () => {
  fake = fakeClient({ delay: 0 });
  setPilotClient(() => fake);
  const r = await call("POST", "/api/pilot/chat", user("Hola, ¿qué podés hacer?"), { ip: "10.1.0.2" });
  assert.equal(r.status, 200);
  assert.equal(r.events[0].t, "start");
  assert.match(r.text, /CeBe Pilot/);
  assert.equal(r.done.stop, "end_turn");
  assert.equal(r.done.cont, null);
  assert.equal(r.done.remaining, DEFAULT_CONFIG.freePerDay - 1);
  const p = fake.calls.at(-1);
  assert.equal(p.model, "claude-haiku-5-5");
  assert.equal(p.betas, undefined, "Haiku no usa el parámetro fallbacks");
  assert.match(p.system[0].text, /CeBe Pilot/);
  assert.match(p.system[0].text, /CeBe Studio/, "sabe recomendar a CeBe Studio cuando aplique");
  assert.ok(p.system[0].cache_control);
});

test("valida el origen, el último mensaje y el largo", async () => {
  assert.equal((await call("POST", "/api/pilot/chat", user("hola"), { origin: false })).status, 403);
  assert.equal((await call("POST", "/api/pilot/chat", { messages: [{ role: "user", content: "a" }, { role: "assistant", content: "b" }] })).data.error, "bad_messages");
  assert.equal((await call("POST", "/api/pilot/chat", { messages: [] })).data.error, "bad_messages");
  assert.equal((await call("POST", "/api/pilot/chat", user("x".repeat(13000)))).data.error, "too_long");
});

test("el modo tarea agrega sus instrucciones sin romper el prefijo en caché", async () => {
  await call("POST", "/api/pilot/chat", { ...user("Escribí 3 eslóganes"), mode: "task" }, { ip: "10.1.0.3" });
  const p = fake.calls.at(-1);
  assert.equal(p.system.length, 2);
  assert.match(p.system[1].text, /Modo tarea/);
  assert.equal(p.system[1].cache_control, undefined);
  assert.equal(p.output_config.effort, "medium");
});

test("el límite diario del plan gratis se respeta", async () => {
  await savePilotConfig({ ...DEFAULT_CONFIG, freePerDay: 2 });
  const ip = "10.1.0.4";
  assert.equal((await call("POST", "/api/pilot/chat", user("uno"), { ip })).status, 200);
  assert.equal((await call("POST", "/api/pilot/chat", user("dos"), { ip })).status, 200);
  const r = await call("POST", "/api/pilot/chat", user("tres"), { ip });
  assert.equal(r.status, 429);
  assert.equal(r.data.error, "quota");
  await savePilotConfig({ ...DEFAULT_CONFIG });
});

test("si se acerca el límite de tiempo, corta y la continuación no cuenta como mensaje nuevo", async () => {
  process.env.PILOT_DEADLINE_MS = "600";
  const slow = fakeClient({ delay: 40, reply: "palabra ".repeat(60) });
  setPilotClient(() => slow);
  const ip = "10.1.0.5";
  const r = await call("POST", "/api/pilot/chat", user("Escribí algo largo"), { ip });
  assert.equal(r.done.stop, "continue");
  assert.ok(r.done.cont, "entrega un pase de continuación");
  assert.ok(r.text.length > 0 && r.text.length < 480);
  const before = r.done.remaining;
  process.env.PILOT_DEADLINE_MS = "60000";
  const c = await call("POST", "/api/pilot/chat", { ...user("Escribí algo largo"), partial: r.text, cont: r.done.cont }, { ip: "10.1.0.99" });
  assert.equal(c.status, 200);
  assert.equal(c.done.remaining, before, "no descuenta otro mensaje");
  const p = slow.calls.at(-1);
  assert.equal(p.messages.at(-2).role, "assistant");
  assert.equal(p.messages.at(-2).content, r.text);
  assert.match(p.messages.at(-1).content, /Continuá exactamente/);
  assert.equal((await call("POST", "/api/pilot/chat", { ...user("x"), cont: "falso.firma" })).data.error, "bad_cont");
  delete process.env.PILOT_DEADLINE_MS;
  setPilotClient(() => fake);
});

test("códigos de acceso: el dueño crea uno, el cliente lo activa y pasa a Pro", async () => {
  assert.equal((await call("GET", "/api/admin/pilot")).status, 401);
  const bad = await call("POST", "/api/admin/pilot/code", { plan: "oro", days: 30 }, { auth: true });
  assert.equal(bad.data.error, "bad_plan");
  const c = await call("POST", "/api/admin/pilot/code", { plan: "pro", days: 30, label: "Ana" }, { auth: true });
  assert.equal(c.status, 200);
  assert.match(c.data.code, /^CBP-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  assert.equal((await call("POST", "/api/pilot/activate", { code: "CBP-AAAA-BBBB-CCCC" })).status, 403);
  const a = await call("POST", "/api/pilot/activate", { code: c.data.code.toLowerCase().replace(/-/g, " ") });
  assert.equal(a.status, 200);
  assert.equal(a.data.plan, "pro");
  const s = await call("POST", "/api/pilot/status", { pass: a.data.pass });
  assert.equal(s.data.plan, "pro");
  assert.equal(s.data.parallel, 4);
  const r = await call("POST", "/api/pilot/chat", { ...user("hola"), pass: a.data.pass });
  assert.equal(r.status, 200);
  const p = fake.calls.at(-1);
  assert.equal(p.model, "claude-sonnet-5-5");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.thinking, { type: "between_tools" });
  // pase manipulado → plan gratis
  assert.equal((await call("POST", "/api/pilot/status", { pass: a.data.pass.slice(0, -2) + "xx" })).data.plan, "gratis");
  // el dueño lo desactiva → vuelve a gratis
  const o = await call("GET", "/api/admin/pilot", undefined, { auth: true });
  const id = o.data.codes.find(x => x.label === "Ana").id;
  assert.equal(o.data.codes[0].code, undefined, "el código en claro nunca se guarda");
  assert.equal((await call("POST", "/api/admin/pilot/revoke", { id }, { auth: true })).status, 200);
  assert.equal((await call("POST", "/api/pilot/status", { pass: a.data.pass })).data.plan, "gratis");
});

test("lleva la cuenta del gasto y pausa el plan gratis al llegar al tope", async () => {
  const o = await call("GET", "/api/admin/pilot", undefined, { auth: true });
  assert.ok(o.data.spend.usd > 0);
  assert.ok(o.data.spend.msgs >= 5);
  await putJSON("pilot", `gasto/${month()}`, { ...o.data.spend, usd: DEFAULT_CONFIG.budgetUsd * 0.8 });
  const r = await call("POST", "/api/pilot/chat", user("hola"), { ip: "10.1.0.6" });
  assert.equal(r.status, 503);
  assert.equal(r.data.error, "free_paused");
  const cfg = await call("POST", "/api/admin/pilot/config", { config: { ...DEFAULT_CONFIG, budgetUsd: 0 } }, { auth: true });
  assert.equal(cfg.data.error, "bad_budget");
  assert.equal((await call("POST", "/api/admin/pilot/config", { config: { ...DEFAULT_CONFIG, budgetUsd: 100 } }, { auth: true })).status, 200);
  assert.equal((await call("POST", "/api/pilot/chat", user("hola"), { ip: "10.1.0.6" })).status, 200);
});

test("asistentes, modo detallado y archivos adjuntos", async () => {
  setPilotClient(() => fake);
  await call("POST", "/api/pilot/chat", { ...user("Haceme una landing"), assistant: "web", style: "detallado" }, { ip: "10.1.0.20" });
  let p = fake.calls.at(-1);
  assert.ok(p.system.some(b => /Diseñador web/.test(b.text)));
  assert.ok(p.system.some(b => /Modo Turbo/.test(b.text)));
  assert.ok(p.system.some(b => /tico amigable/.test(b.text)), "habla tico por defecto");
  assert.equal(p.output_config.effort, "medium");
  await call("POST", "/api/pilot/chat", { ...user("hola"), assistant: "inventado", habla: "formal" }, { ip: "10.1.0.21" });
  assert.ok(fake.calls.at(-1).system.some(b => /Forma de hablar: formal/.test(b.text)));
  p = fake.calls.at(-1);
  assert.ok(p.system.some(b => /Modo Crucero/.test(b.text)));
  assert.ok(!p.system.some(b => /# Asistente/.test(b.text)), "un asistente desconocido se ignora");
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");
  const r = await call("POST", "/api/pilot/chat", { ...user("¿Qué ves?"), attachments: [{ kind: "image", name: "foto.jpg", media: "image/jpeg", data: png }, { kind: "text", name: "notas.md", text: "Lista de precios" }, { kind: "pdf", name: "doc.pdf", data: png }] }, { ip: "10.1.0.22" });
  assert.equal(r.status, 200);
  const last = fake.calls.at(-1).messages.at(-1).content;
  assert.deepEqual(last.map(b => b.type), ["image", "text", "document", "text"]);
  assert.match(last[1].text, /<archivo nombre="notas.md">/);
  assert.equal(last.at(-1).text, "¿Qué ves?");
  assert.equal((await call("POST", "/api/pilot/chat", { ...user("x"), attachments: [{ kind: "image", name: "a.svg", media: "image/svg+xml", data: png }] }, { ip: "10.1.0.23" })).data.error, "bad_file");
  assert.equal((await call("POST", "/api/pilot/chat", { ...user("x"), attachments: [{ kind: "exe", name: "a.exe" }] }, { ip: "10.1.0.23" })).data.error, "bad_file");
  assert.equal((await call("POST", "/api/pilot/chat", { ...user("x"), attachments: Array(6).fill({ kind: "text", name: "a", text: "b" }) }, { ip: "10.1.0.23" })).data.error, "too_many_files");
});

test("si la respuesta llega al largo máximo, sigue sola sin contar otro mensaje", async () => {
  const long = fakeClient({ delay: 0, reply: "parte ", stop: "max_tokens" });
  setPilotClient(() => long);
  const r = await call("POST", "/api/pilot/chat", user("Una página enorme"), { ip: "10.1.0.30" });
  assert.equal(r.done.stop, "continue");
  assert.ok(r.done.cont);
  const c = await call("POST", "/api/pilot/chat", { ...user("Una página enorme"), partial: r.text, cont: r.done.cont }, { ip: "10.1.0.30" });
  assert.equal(c.done.remaining, r.done.remaining, "la continuación no descuenta uso");
  setPilotClient(() => fake);
});
