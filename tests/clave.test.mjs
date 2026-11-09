// Recuperar contraseña por correo (Resend simulado): enlace de un solo uso, vence, no revela si el correo existe.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setStoreFactory, memoryFactory } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setMailFetch } from "../netlify/lib/mail.mjs";

const ORIGIN = "https://cbpilot.test";
let n = 0, mails = [];
async function call(method, path, body, { cookie = "" } = {}) {
  const h = { "content-type": "application/json", origin: ORIGIN };
  if (cookie) h.cookie = cookie;
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip: `10.6.0.${++n % 250}` });
  return { status: res.status, data: await res.json(), cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const tokenFrom = m => decodeURIComponent(JSON.parse(m.init.body).text.match(/clave=([^\s]+)/)[1]);

before(async () => {
  setStoreFactory(memoryFactory());
  setMailFetch(async (url, init) => { mails.push({ url, init }); return new Response("{}", { status: 200 }); });
  await call("POST", "/api/account/register", { name: "Eva", email: "eva@clave.test", password: "clave-vieja-1" });
});

test("sin correo configurado avisa que se haga por WhatsApp", async () => {
  delete process.env.RESEND_API_KEY;
  assert.equal((await call("POST", "/api/pilot/status", {})).data.mailOn, false);
  assert.equal((await call("POST", "/api/account/forgot", { email: "eva@clave.test" })).data.error, "mail_off");
});

test("envía el enlace, sirve una sola vez y cierra las sesiones viejas", async () => {
  Object.assign(process.env, { RESEND_API_KEY: "re_test", MAIL_FROM: "CB Pilot <no-responder@cebestudiocr.com>" });
  const vieja = (await call("POST", "/api/account/login", { email: "eva@clave.test", password: "clave-vieja-1" })).cookie;
  assert.equal((await call("POST", "/api/account/forgot", { email: "nadie@clave.test" })).status, 200, "no revela si existe");
  assert.equal(mails.length, 0);
  assert.equal((await call("POST", "/api/account/forgot", { email: "EVA@clave.test" })).status, 200);
  assert.equal(mails.length, 1);
  const body = JSON.parse(mails[0].init.body);
  assert.deepEqual(body.to, ["eva@clave.test"]);
  assert.match(body.text, /https:\/\/cbpilot\.test\/\?clave=/);
  const token = tokenFrom(mails[0]);
  assert.equal((await call("POST", "/api/account/reset", { token, password: "corta" })).data.error, "weak_password");
  const r = await call("POST", "/api/account/reset", { token, password: "clave-nueva-2" });
  assert.equal(r.status, 200);
  assert.match(r.cookie, /^cbpilot_user=/);
  assert.equal((await call("POST", "/api/account/reset", { token, password: "otra-clave-3" })).data.error, "bad_token", "una sola vez");
  assert.equal((await call("GET", "/api/account/me", undefined, { cookie: vieja })).data.user, null, "sesión vieja cerrada");
  assert.equal((await call("POST", "/api/account/login", { email: "eva@clave.test", password: "clave-nueva-2" })).status, 200);
  assert.equal((await call("POST", "/api/account/reset", { token: "inventado", password: "clave-x-12345" })).data.error, "bad_token");
});
