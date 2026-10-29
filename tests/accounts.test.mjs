// Pruebas de las cuentas de clientes: registro, sesión, plan en la cuenta y gestión desde el panel (IA simulada).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setStoreFactory, memoryFactory } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setPilotClient, savePilotConfig, DEFAULT_CONFIG } from "../netlify/lib/pilot.mjs";
import { fakeClient } from "./pilot-fake.mjs";

const ORIGIN = "https://cbpilot.test";
let admin = "", fake, n = 0;

async function call(method, path, body, { cookie = "", origin = true } = {}) {
  const h = { "content-type": "application/json" };
  if (origin) h.origin = ORIGIN;
  if (cookie) h.cookie = cookie;
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip: `10.8.0.${++n % 250}` });
  const ct = res.headers.get("content-type") || "";
  const sc = res.headers.get("set-cookie") || "";
  const data = ct.includes("ndjson") ? { events: (await res.text()).split("\n").filter(Boolean).map(l => JSON.parse(l)) } : await res.json();
  return { status: res.status, data, cookie: sc.split(";")[0] };
}
const chat = (cookie, extra = {}) => call("POST", "/api/pilot/chat", { messages: [{ role: "user", content: "hola" }], ...extra }, { cookie });

before(async () => {
  setStoreFactory(memoryFactory());
  process.env.ADMIN_SETUP_CODE = "codigo-de-prueba-123";
  await call("POST", "/api/admin/setup", { code: "codigo-de-prueba-123", email: "dueno@example.com", password: "contraseña-larga-1" });
  admin = (await call("POST", "/api/admin/login", { email: "dueno@example.com", password: "contraseña-larga-1" })).cookie;
  fake = fakeClient({ delay: 0, reply: "ok" });
  setPilotClient(() => fake);
});

test("registro, sesión, perfil y cierre de sesión", async () => {
  assert.equal((await call("POST", "/api/account/register", { name: "Ana", email: "malo", password: "12345678" })).data.error, "bad_email");
  assert.equal((await call("POST", "/api/account/register", { name: "Ana", email: "ana@example.com", password: "corta" })).data.error, "weak_password");
  assert.equal((await call("POST", "/api/account/register", { name: "", email: "ana@example.com", password: "12345678" })).data.error, "no_name");
  assert.equal((await call("POST", "/api/account/register", { name: "Ana", email: "ana@example.com", password: "clave-de-ana" }, { origin: false })).status, 403);
  const r = await call("POST", "/api/account/register", { name: "Ana", email: "Ana@Example.com", password: "clave-de-ana" });
  assert.equal(r.status, 200);
  assert.match(r.cookie, /^cbpilot_user=/);
  assert.equal(r.data.user.email, "ana@example.com");
  assert.equal(r.data.user.hash, undefined, "nunca se expone el hash");
  assert.equal((await call("POST", "/api/account/register", { name: "Otra", email: "ana@example.com", password: "otra-clave-1" })).data.error, "exists");
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: r.cookie })).data.user.name, "Ana");
  assert.equal((await call("GET", "/api/account/me")).data.user, null);
  assert.equal((await call("POST", "/api/account/login", { email: "ana@example.com", password: "incorrecta" })).data.error, "bad_login");
  assert.equal((await call("POST", "/api/account/login", { email: "nadie@example.com", password: "incorrecta" })).data.error, "bad_login");
  const l = await call("POST", "/api/account/login", { email: "ANA@example.com", password: "clave-de-ana" });
  assert.equal(l.status, 200);
  assert.equal((await call("POST", "/api/account/profile", { name: "Ana Mora" }, { cookie: l.cookie })).data.user.name, "Ana Mora");
  const st = await call("POST", "/api/pilot/status", {}, { cookie: l.cookie });
  assert.equal(st.data.user.name, "Ana Mora");
  assert.equal(st.data.plan, "gratis");
  assert.match((await call("POST", "/api/account/logout", {})).cookie, /^cbpilot_user=$/);
});

test("cambiar la contraseña cierra las otras sesiones", async () => {
  const a = (await call("POST", "/api/account/register", { name: "Beto", email: "beto@example.com", password: "clave-beto-1" })).cookie;
  const b = (await call("POST", "/api/account/login", { email: "beto@example.com", password: "clave-beto-1" })).cookie;
  assert.equal((await call("POST", "/api/account/password", { current: "mala", next: "clave-beto-2" }, { cookie: a })).data.error, "bad_password");
  const r = await call("POST", "/api/account/password", { current: "clave-beto-1", next: "clave-beto-2" }, { cookie: a });
  assert.equal(r.status, 200);
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: b })).data.user, null, "la otra sesión ya no vale");
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: r.cookie })).data.user.email, "beto@example.com");
});

test("un código canjeado con sesión queda en la cuenta y no se puede usar en otra", async () => {
  const c = await call("POST", "/api/admin/pilot/code", { plan: "pro", days: 30, label: "Cami" }, { cookie: admin });
  const cami = (await call("POST", "/api/account/register", { name: "Cami", email: "cami@example.com", password: "clave-cami-1" })).cookie;
  const a = await call("POST", "/api/pilot/activate", { code: c.data.code }, { cookie: cami });
  assert.equal(a.data.account, true);
  assert.equal(a.data.pass, undefined, "con cuenta no hace falta pase del dispositivo");
  // desde "otro dispositivo": nueva sesión de la misma cuenta
  const otra = (await call("POST", "/api/account/login", { email: "cami@example.com", password: "clave-cami-1" })).cookie;
  const st = await call("POST", "/api/pilot/status", {}, { cookie: otra });
  assert.equal(st.data.plan, "pro");
  await chat(otra);
  assert.equal(fake.calls.at(-1).model, "claude-sonnet-5-5");
  // otra cuenta no puede usarlo, ni sin sesión
  const dani = (await call("POST", "/api/account/register", { name: "Dani", email: "dani@example.com", password: "clave-dani-1" })).cookie;
  assert.equal((await call("POST", "/api/pilot/activate", { code: c.data.code }, { cookie: dani })).data.error, "code_taken");
  assert.equal((await call("POST", "/api/pilot/activate", { code: c.data.code })).data.error, "code_taken");
  // si el dueño desactiva el código, la cuenta vuelve a gratis
  const id = (await call("GET", "/api/admin/pilot", undefined, { cookie: admin })).data.codes.find(x => x.label === "Cami").id;
  await call("POST", "/api/admin/pilot/revoke", { id }, { cookie: admin });
  assert.equal((await call("POST", "/api/pilot/status", {}, { cookie: otra })).data.plan, "gratis");
});

test("el dueño da planes, bloquea, cambia la contraseña y elimina cuentas", async () => {
  assert.equal((await call("GET", "/api/admin/users")).status, 401);
  const eva = (await call("POST", "/api/account/register", { name: "Eva", email: "eva@example.com", password: "clave-eva-1" })).cookie;
  const list = (await call("GET", "/api/admin/users", undefined, { cookie: admin })).data.users;
  const id = list.find(u => u.email === "eva@example.com").id;
  assert.equal(list[0].hash, undefined);
  assert.equal((await call("POST", "/api/admin/users/action", { id, action: "plan", plan: "oro", days: 30 }, { cookie: admin })).data.error, "bad_plan");
  const p = await call("POST", "/api/admin/users/action", { id, action: "plan", plan: "max", days: 30 }, { cookie: admin });
  assert.equal(p.data.user.plan, "max");
  const p2 = await call("POST", "/api/admin/users/action", { id, action: "plan", plan: "max", days: 30 }, { cookie: admin });
  assert.ok(Date.parse(p2.data.user.planExpiresAt) - Date.now() > 55 * 864e5, "renovar suma días");
  await chat(eva);
  assert.equal(fake.calls.at(-1).model, "claude-opus-5-5");
  assert.equal((await call("POST", "/api/admin/users/action", { id, action: "removePlan" }, { cookie: admin })).data.user.plan, "gratis");
  // bloquear: la sesión deja de valer y no puede volver a entrar
  await call("POST", "/api/admin/users/action", { id, action: "block" }, { cookie: admin });
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: eva })).data.user, null);
  assert.equal((await call("POST", "/api/account/login", { email: "eva@example.com", password: "clave-eva-1" })).data.error, "blocked");
  await call("POST", "/api/admin/users/action", { id, action: "unblock" }, { cookie: admin });
  // contraseña temporal
  const t = await call("POST", "/api/admin/users/action", { id, action: "resetPassword" }, { cookie: admin });
  assert.ok(t.data.tempPassword.length >= 10);
  assert.equal((await call("POST", "/api/account/login", { email: "eva@example.com", password: "clave-eva-1" })).data.error, "bad_login");
  assert.equal((await call("POST", "/api/account/login", { email: "eva@example.com", password: t.data.tempPassword })).status, 200);
  await call("POST", "/api/admin/users/action", { id, action: "delete" }, { cookie: admin });
  assert.equal((await call("POST", "/api/account/login", { email: "eva@example.com", password: t.data.tempPassword })).data.error, "bad_login");
  // el correo queda libre para registrarse de nuevo
  assert.equal((await call("POST", "/api/account/register", { name: "Eva", email: "eva@example.com", password: "clave-eva-9" })).status, 200);
});

test("el cliente puede eliminar su cuenta", async () => {
  const f = (await call("POST", "/api/account/register", { name: "Fer", email: "fer@example.com", password: "clave-fer-1" })).cookie;
  assert.equal((await call("POST", "/api/account/delete", { password: "mala" }, { cookie: f })).data.error, "bad_password");
  assert.equal((await call("POST", "/api/account/delete", { password: "clave-fer-1" }, { cookie: f })).status, 200);
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: f })).data.user, null);
});

test("con «pedir cuenta» activado, sin sesión no se puede chatear", async () => {
  await savePilotConfig({ ...DEFAULT_CONFIG, requireAccount: true });
  const r = await chat("");
  assert.equal(r.status, 401);
  assert.equal(r.data.error, "login_required");
  assert.equal((await call("POST", "/api/pilot/status", {})).data.requireAccount, true);
  const g = (await call("POST", "/api/account/register", { name: "Gabi", email: "gabi@example.com", password: "clave-gabi-1" })).cookie;
  assert.equal((await chat(g)).status, 200);
  await savePilotConfig({ ...DEFAULT_CONFIG });
});
