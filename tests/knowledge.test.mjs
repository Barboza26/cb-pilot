// Pruebas de la base de conocimiento: extracción de texto, búsqueda y uso en el chat (IA simulada, sin internet).
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setStoreFactory, memoryFactory } from "../netlify/lib/db.mjs";
import handler from "../netlify/functions/api.mjs";
import { setPilotClient } from "../netlify/lib/pilot.mjs";
import { htmlToText, chunk, terms, checkUrl, search } from "../netlify/lib/knowledge.mjs";
import { fakeClient } from "./pilot-fake.mjs";

const ORIGIN = "https://cbpilot.test";
let cookie = "", fake, ip = 0;

async function call(method, path, body, { auth = true, form } = {}) {
  const h = { origin: ORIGIN };
  if (auth) h.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { payload = JSON.stringify(body); h["content-type"] = "application/json"; }
  const res = await handler(new Request(ORIGIN + path, { method, headers: h, body: payload }), { ip: `10.7.0.${++ip % 250}` });
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("ndjson")) { const events = (await res.text()).split("\n").filter(Boolean).map(l => JSON.parse(l)); return { status: res.status, events }; }
  return { status: res.status, data: await res.json() };
}
const chat = content => call("POST", "/api/pilot/chat", { messages: [{ role: "user", content }] }, { auth: false });
const sources = r => r.events.find(e => e.t === "sources")?.items || [];
const fileForm = (name, data, type) => { const f = new FormData(); f.append("file", new Blob([data], { type }), name); return f; };

before(async () => {
  setStoreFactory(memoryFactory());
  process.env.ADMIN_SETUP_CODE = "codigo-de-prueba-123";
  await call("POST", "/api/admin/setup", { code: "codigo-de-prueba-123", email: "dueno@example.com", password: "contraseña-larga-1" }, { auth: false });
  const r = await handler(new Request(ORIGIN + "/api/admin/login", { method: "POST", headers: { origin: ORIGIN, "content-type": "application/json" }, body: JSON.stringify({ email: "dueno@example.com", password: "contraseña-larga-1" }) }), { ip: "10.7.9.9" });
  cookie = r.headers.get("set-cookie").split(";")[0];
  fake = fakeClient({ delay: 0, reply: "Respuesta de prueba." });
  setPilotClient(() => fake);
});

test("convierte HTML en texto limpio", () => {
  const r = htmlToText(`<html><head><title>Mi &amp; Página</title><meta name="description" content="Resumen corto"><style>.x{}</style></head>
    <body><nav>Inicio Menú</nav><h1>Hola</h1><p>Precio: &#8353;2&nbsp;500 &aacute;</p><ul><li>Uno</li><li>Dos</li></ul><script>alert(1)</script><footer>pie</footer></body></html>`);
  assert.equal(r.title, "Mi & Página");
  assert.match(r.text, /^Resumen corto/);
  assert.match(r.text, /# Hola/);
  assert.match(r.text, /₡2 500 á/);
  assert.match(r.text, /- Uno\n- Dos/);
  assert.doesNotMatch(r.text, /alert|Menú|pie|\.x/);
});

test("fragmentos, palabras y enlaces permitidos", () => {
  const parts = chunk(("Una oración bastante larga sobre panes y cafés. ").repeat(200));
  assert.ok(parts.length > 3);
  assert.ok(parts.every(p => p.length <= 1400));
  assert.deepEqual(terms("¿Cuánto cuestan los Panes?"), ["cuanto", "cuestan", "pane"]);
  for (const bad of ["ftp://x.com", "http://localhost/a", "http://127.0.0.1", "http://192.168.1.4/", "http://10.0.0.1", "http://[::1]/", "http://intranet/"]) assert.throws(() => checkUrl(bad));
  assert.equal(checkUrl("https://Ejemplo.com/a#parte"), "https://ejemplo.com/a");
});

test("búsqueda: el fragmento relevante sale primero", () => {
  const idx = { v: "t1", chunks: [{ s: "a", t: "Horarios", u: "", x: "Abrimos de lunes a viernes." }, { s: "b", t: "Precios", u: "", x: "El pan cuesta 2500 colones y el café 1500." }] };
  const r = search(idx, "¿Cuánto cuesta el pan?");
  assert.equal(r[0].s, "b");
  assert.equal(search(idx, "zzz qqq").length, 0);
});

test("texto: se agrega, el chat lo usa como referencia y muestra la fuente", async () => {
  assert.equal((await call("POST", "/api/admin/knowledge/text", { title: "Horario", text: "corto" })).data.error, "empty");
  assert.equal((await call("POST", "/api/admin/knowledge/text", { title: "", text: "x".repeat(100) })).data.error, "no_title");
  const r = await call("POST", "/api/admin/knowledge/text", { title: "Horario de la tienda", text: "La tienda abre de lunes a sábado de 8 am a 6 pm. Los domingos está cerrada por descanso del personal." });
  assert.equal(r.status, 200);
  const st = await call("GET", "/api/admin/knowledge");
  assert.equal(st.data.active, 1);
  const c = await chat("¿Qué horario tiene la tienda los domingos?");
  const p = fake.calls.at(-1);
  assert.match(p.system[1].text, /Base de conocimiento/);
  assert.match(p.system[1].text, /Los domingos está cerrada/);
  assert.ok(p.system[1].cache_control, "base chica: completa y en caché");
  assert.equal(p.system[0].cache_control, undefined);
  assert.deepEqual(sources(c).map(x => x.title), ["Horario de la tienda"]);
  // una pregunta sin relación no muestra fuentes
  assert.equal(sources(await chat("Escribí un poema sobre el mar")).length, 0);
});

test("archivos: PDF real y TXT; formatos raros se rechazan", async () => {
  const pdf = readFileSync(new URL("./fixtures/panaderia.pdf", import.meta.url));
  const r = await call("POST", "/api/admin/knowledge/file", undefined, { form: fileForm("panaderia.pdf", pdf, "application/pdf") });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.source.title, "panaderia");
  const prev = await call("GET", `/api/admin/knowledge/source?id=${r.data.source.id}`);
  assert.match(prev.data.text, /masa madre cuesta 2500/);
  const t = await call("POST", "/api/admin/knowledge/file", undefined, { form: fileForm("faq.md", "# Preguntas\n\n¿Hacen envíos? Sí, a todo el país por Correos de Costa Rica.", "text/markdown") });
  assert.equal(t.status, 200);
  const bad = await call("POST", "/api/admin/knowledge/file", undefined, { form: fileForm("foto.exe", new Uint8Array([1, 2, 3, 0, 0]), "application/octet-stream") });
  assert.equal(bad.data.error, "bad_type");
  const s = await call("POST", "/api/admin/knowledge/search", { q: "masa madre" });
  assert.equal(s.data.results[0].t, "panaderia");
});

test("enlaces: lee la página, actualiza sin duplicar y bloquea direcciones privadas", async () => {
  const real = globalThis.fetch;
  let version = 1;
  globalThis.fetch = async url => new Response(`<html><head><title>Promos</title></head><body><main><h1>Promociones</h1><p>Versión ${version}: dos cafés por el precio de uno todos los martes en la cafetería.</p></main></body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  try {
    const r = await call("POST", "/api/admin/knowledge/url", { urls: ["https://ejemplo.com/promos", "http://localhost:3000/x"] });
    assert.equal(r.data.results[0].ok, true);
    assert.equal(r.data.results[1].ok, false);
    const id = r.data.results[0].source.id;
    version = 2;
    await call("POST", "/api/admin/knowledge/url", { urls: ["https://ejemplo.com/promos"] });
    const st = await call("GET", "/api/admin/knowledge");
    assert.equal(st.data.sources.filter(x => x.url === "https://ejemplo.com/promos").length, 1, "el mismo enlace no se duplica");
    version = 3;
    assert.equal((await call("POST", "/api/admin/knowledge/refresh", { id })).status, 200);
    assert.match((await call("GET", `/api/admin/knowledge/source?id=${id}`)).data.text, /Versión 3/);
    const c = await chat("¿Qué promoción hay los martes?");
    assert.deepEqual(sources(c)[0], { title: "Promos", url: "https://ejemplo.com/promos" });
  } finally { globalThis.fetch = real; }
});

test("desactivar y eliminar: deja de usarse en el chat", async () => {
  const list = (await call("GET", "/api/admin/knowledge")).data.sources;
  const h = list.find(x => x.title === "Horario de la tienda");
  await call("POST", "/api/admin/knowledge/active", { id: h.id, active: false });
  await chat("horario domingos");
  assert.doesNotMatch(fake.calls.at(-1).system[1].text, /domingos está cerrada/);
  await call("POST", "/api/admin/knowledge/active", { id: h.id, active: true });
  assert.equal((await call("POST", "/api/admin/knowledge/delete", { id: h.id })).status, 200);
  assert.equal((await call("POST", "/api/admin/knowledge/delete", { id: h.id })).data.error, "not_found");
});

test("base grande: solo manda los fragmentos relevantes", async () => {
  const temas = ["fútbol", "astronomía", "jardinería", "guitarra", "ajedrez", "natación", "fotografía", "cerámica", "ciclismo", "panadería", "yoga", "pintura", "teatro", "robótica", "apicultura", "surf", "cocina", "poesía", "historia", "química"];
  for (const tema of temas) await call("POST", "/api/admin/knowledge/text", { title: `Guía de ${tema}`, text: `Todo sobre ${tema}. `.repeat(70) + `Dato clave de ${tema}: practicar con constancia.` });
  assert.ok((await call("GET", "/api/admin/knowledge")).data.chars > 24000);
  const c = await chat("Dame consejos de apicultura");
  const p = fake.calls.at(-1);
  assert.ok(p.system[0].cache_control, "la personalidad sigue en caché");
  assert.equal(p.system[1].cache_control, undefined);
  assert.match(p.system[1].text, /apicultura/);
  assert.doesNotMatch(p.system[1].text, /Guía de guitarra/);
  assert.equal(sources(c)[0].title, "Guía de apicultura");
  assert.equal((await call("GET", "/api/admin/knowledge", undefined, { auth: false })).status, 401);
});
