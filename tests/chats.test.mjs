// Chats guardados en la cuenta: solo con la opción activada, cifrados, separados por cuenta y borrables.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { setStoreFactory, memoryFactory, listKeys, getJSON } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";

const ORIGIN = "https://cbpilot.test";
let n = 0;
async function call(method, path, body, { cookie = "", origin = true } = {}) {
  const h = { "content-type": "application/json" };
  if (origin) h.origin = ORIGIN;
  if (cookie) h.cookie = cookie;
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) }), { ip: `10.7.0.${++n % 250}` });
  return { status: res.status, data: await res.json(), cookie: (res.headers.get("set-cookie") || "").split(";")[0] };
}
const chat = (id, updated, text) => ({ id, title: "Chat " + id, created: 1, updated, pinned: false, messages: [{ role: "user", content: text, files: [{ kind: "image", name: "foto.png", thumb: "data:image/png;base64,AAAA" }] }, { role: "assistant", content: "respuesta", fuel: 1.2 }, { role: "assistant", content: "", pending: true }] });
let ana, beto;

before(async () => {
  setStoreFactory(memoryFactory());
  ana = (await call("POST", "/api/account/register", { name: "Ana", email: "ana@chats.test", password: "clave-ana-123" })).cookie;
  beto = (await call("POST", "/api/account/register", { name: "Beto", email: "beto@chats.test", password: "clave-beto-123" })).cookie;
});

test("sin activar la opción no se guarda nada", async () => {
  assert.equal((await call("GET", "/api/chats")).data.error, "no_session");
  assert.equal((await call("GET", "/api/chats", undefined, { cookie: ana })).data.error, "sync_off");
  assert.equal((await call("POST", "/api/chats/save", { chats: [chat("aaaa1", 10, "hola")] }, { cookie: ana })).data.error, "sync_off");
});

test("con la opción activada se guardan cifrados, sin fotos, y otra sesión los ve", async () => {
  const p = await call("POST", "/api/account/profile", { syncChats: true }, { cookie: ana });
  assert.equal(p.data.user.syncChats, true);
  assert.equal(p.data.user.name, "Ana", "activarlo no borra el nombre");
  assert.equal((await call("POST", "/api/chats/save", { chats: [chat("aaaa1", 10, "secreto de Ana")] }, { cookie: ana, origin: false })).status, 403);
  assert.equal((await call("POST", "/api/chats/save", { chats: [chat("aaaa1", 10, "secreto de Ana")] }, { cookie: ana })).data.saved, 1);
  const raw = (await getJSON("chats", (await listKeys("chats", ""))[0])).data;
  assert.ok(!JSON.stringify(raw).includes("secreto"), "guardado cifrado");
  const otra = (await call("POST", "/api/account/login", { email: "ana@chats.test", password: "clave-ana-123" })).cookie;
  const list = (await call("GET", "/api/chats", undefined, { cookie: otra })).data.chats;
  assert.equal(list.length, 1);
  assert.equal(list[0].messages[0].content, "secreto de Ana");
  assert.equal(list[0].messages[0].files[0].thumb, undefined, "no guarda las fotos");
  assert.equal(list[0].messages.length, 2, "no guarda respuestas a medias");
  assert.equal(list[0].messages[1].fuel, 1.2);
});

test("una versión vieja no pisa la nueva, y cada cuenta ve solo lo suyo", async () => {
  await call("POST", "/api/chats/save", { chats: [chat("aaaa1", 20, "versión nueva")] }, { cookie: ana });
  await call("POST", "/api/chats/save", { chats: [chat("aaaa1", 15, "versión vieja")] }, { cookie: ana });
  assert.equal((await call("GET", "/api/chats", undefined, { cookie: ana })).data.chats[0].messages[0].content, "versión nueva");
  await call("POST", "/api/account/profile", { syncChats: true }, { cookie: beto });
  assert.equal((await call("GET", "/api/chats", undefined, { cookie: beto })).data.chats.length, 0, "Beto no ve los chats de Ana");
  assert.equal((await call("POST", "/api/chats/save", { chats: [{ ...chat("x", 1, "a") }] }, { cookie: beto })).data.error, "bad_id");
});

test("se pueden borrar uno a uno, y al desactivar la opción se borran todos de la cuenta", async () => {
  await call("POST", "/api/chats/save", { chats: [chat("bbbb2", 30, "otro")] }, { cookie: ana });
  await call("POST", "/api/chats/delete", { ids: ["aaaa1"] }, { cookie: ana });
  assert.deepEqual((await call("GET", "/api/chats", undefined, { cookie: ana })).data.chats.map(c => c.id), ["bbbb2"]);
  await call("POST", "/api/account/profile", { syncChats: false }, { cookie: ana });
  assert.equal((await listKeys("chats", "")).filter(k => k.includes("/")).length, 0, "no queda nada guardado");
});
