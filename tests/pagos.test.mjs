// Pagos con ONVO (simulado): enlace de pago, aviso del webhook y activación del plan una sola vez.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setStoreFactory, memoryFactory } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setPayFetch } from "../netlify/lib/payments.mjs";

const ORIGIN = "https://cbpilot.test";
let n = 0, sent = [];
async function call(method, path, body, { cookie = "", origin = true, headers = {} } = {}) {
  const h = { "content-type": "application/json", ...headers };
  if (origin) h.origin = ORIGIN;
  if (cookie) h.cookie = cookie;
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip: `10.9.0.${++n % 250}` });
  return { status: res.status, data: await res.json(), cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const hook = (body, secret = "secreto-webhook") => call("POST", "/api/pay/webhook", body, { origin: false, headers: { "x-webhook-secret": secret } });

before(() => {
  setStoreFactory(memoryFactory());
  Object.assign(process.env, { ONVO_SECRET_KEY: "onvo_test_secret_key_x", ONVO_WEBHOOK_SECRET: "secreto-webhook", ONVO_PRICE_PRO: "price_pro", ONVO_PRICE_MAX: "price_max" });
  setPayFetch(async (url, init) => {
    sent.push({ url, init, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ id: "cs_" + sent.length, url: "https://checkout.onvopay.com/pay/cs_" + sent.length }), { status: 201 });
  });
});

test("el estado avisa qué planes se pagan en línea y los precios", async () => {
  const s = await call("POST", "/api/pilot/status", {});
  assert.deepEqual(s.data.payOnline, { pro: true, max: true });
  assert.equal(s.data.plans.pro.price, 10000);
  assert.equal(s.data.plans.max.price, 25000);
});

test("pagar exige una cuenta y crea el enlace de ONVO con el precio del plan", async () => {
  assert.equal((await call("POST", "/api/pay/checkout", { plan: "pro" })).data.error, "login_required");
  const ana = (await call("POST", "/api/account/register", { name: "Ana", email: "ana@pagos.test", password: "clave-ana-123" })).cookie;
  assert.equal((await call("POST", "/api/pay/checkout", { plan: "oro" }, { cookie: ana })).data.error, "bad_plan");
  assert.equal((await call("POST", "/api/pay/checkout", { plan: "pro" }, { cookie: ana, origin: false })).status, 403);
  const r = await call("POST", "/api/pay/checkout", { plan: "pro" }, { cookie: ana });
  assert.equal(r.status, 200);
  assert.match(r.data.url, /^https:\/\/checkout\.onvopay\.com\//);
  const req = sent.at(-1);
  assert.equal(req.url, "https://api.onvopay.com/v1/checkout/sessions/one-time-link");
  assert.equal(req.init.headers.Authorization, "Bearer onvo_test_secret_key_x");
  assert.deepEqual(req.body.lineItems, [{ priceId: "price_pro", quantity: 1 }]);
  assert.equal(req.body.redirectUrl, ORIGIN + "/?pago=ok");
});

test("el aviso de ONVO activa el plan una sola vez y rechaza secretos falsos", async () => {
  const beto = (await call("POST", "/api/account/register", { name: "Beto", email: "beto@pagos.test", password: "clave-beto-123" })).cookie;
  await call("POST", "/api/pay/checkout", { plan: "max" }, { cookie: beto });
  const id = "cs_" + sent.length;
  assert.equal((await hook({ type: "checkout-session.succeeded", data: { id } }, "falso")).status, 401);
  assert.equal((await call("POST", "/api/pilot/status", {}, { cookie: beto })).data.plan, "gratis", "sin aviso válido no hay plan");
  assert.equal((await hook({ type: "payment-intent.succeeded", data: { id: "pi_1" } })).status, 200, "otros eventos se aceptan y se ignoran");
  assert.equal((await hook({ type: "checkout-session.succeeded", data: { id } })).status, 200);
  const s1 = await call("POST", "/api/pilot/status", {}, { cookie: beto });
  assert.equal(s1.data.plan, "max");
  const exp1 = Date.parse(s1.data.user.planExpiresAt);
  assert.ok(exp1 - Date.now() > 29 * 864e5 && exp1 - Date.now() < 31 * 864e5, "30 días");
  await hook({ type: "checkout-session.succeeded", data: { id } }); // ONVO reintenta el mismo aviso
  assert.equal(Date.parse((await call("POST", "/api/pilot/status", {}, { cookie: beto })).data.user.planExpiresAt), exp1, "no suma dos veces");
  assert.equal((await hook({ type: "checkout-session.succeeded", data: { id: "cs_inventado" } })).status, 200, "un pedido desconocido no activa nada");
  // un segundo pago del mismo plan suma 30 días más
  await call("POST", "/api/pay/checkout", { plan: "max" }, { cookie: beto });
  await hook({ type: "checkout-session.succeeded", data: { id: "cs_" + sent.length } });
  const exp2 = Date.parse((await call("POST", "/api/pilot/status", {}, { cookie: beto })).data.user.planExpiresAt);
  assert.ok(exp2 - exp1 > 29 * 864e5, "renovar suma días");
});

test("sin las llaves de ONVO, el pago en línea queda apagado", async () => {
  const k = process.env.ONVO_SECRET_KEY; delete process.env.ONVO_SECRET_KEY;
  assert.deepEqual((await call("POST", "/api/pilot/status", {})).data.payOnline, { pro: false, max: false });
  const c = (await call("POST", "/api/account/register", { name: "Cami", email: "cami@pagos.test", password: "clave-cami-123" })).cookie;
  assert.equal((await call("POST", "/api/pay/checkout", { plan: "pro" }, { cookie: c })).data.error, "pay_off");
  process.env.ONVO_SECRET_KEY = k;
});

test("cada pago suma presupuesto del mes para que los clientes que pagan no se queden sin servicio", async () => {
  const { spend } = await import("../netlify/lib/pilot.mjs");
  const before = (await spend()).extra;
  const d = (await call("POST", "/api/account/register", { name: "Dani", email: "dani@pagos.test", password: "clave-dani-123" })).cookie;
  await call("POST", "/api/pay/checkout", { plan: "pro" }, { cookie: d });
  await hook({ type: "checkout-session.succeeded", data: { id: "cs_" + sent.length } });
  assert.equal((await spend()).extra, before + 8);
});
