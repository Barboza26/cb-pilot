// CB Pilot: asistente de inteligencia artificial independiente (chat tipo ChatGPT/Gemini/Claude).
// Planes, límites, presupuesto mensual, códigos de acceso y conversación con Claude en streaming.
// La clave ANTHROPIC_API_KEY vive SOLO en el servidor (variable de entorno de Netlify); el navegador nunca la ve.
import Anthropic from "@anthropic-ai/sdk";
import { getJSON, update, listKeys } from "./db.mjs";
import { fail, sha256, str, int, now, sign, verify, clientIp } from "./util.mjs";
import crypto from "node:crypto";

// Precios de Anthropic por millón de tokens (USD, octubre 2026). Solo sirven para llevar la cuenta del gasto.
const PRICES = {
  "claude-haiku-5-5": { in: 0.10, out: 0.50, cacheRead: 0.01, cacheWrite: 0.125 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.20, cacheWrite: 2.5 },
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.20, cacheWrite: 5 }
};

// Planes. "perDay"/"perMonth" = mensajes; "parallel" = tareas simultáneas; "chars" = memoria de la conversación.
// thinking: Haiku y Sonnet responden sin razonamiento extendido (más rápido); Opus no permite apagarlo y usa esfuerzo bajo.
export const PLANS = {
  gratis: { name: "Gratis", label: "Pilot Flash", model: "claude-haiku-5-5", perDay: 20, perMonth: null, parallel: 2, maxTokens: 2500, chars: 24000, msgChars: 8000, thinking: { type: "disabled" }, effort: "low", taskEffort: "medium", fallback: false },
  pro: { name: "Pro", label: "Pilot Pro", model: "claude-sonnet-5-5", perDay: 60, perMonth: 500, parallel: 4, maxTokens: 6000, chars: 80000, msgChars: 30000, thinking: { type: "between_tools" }, effort: "low", taskEffort: "medium", fallback: true },
  max: { name: "Max", label: "Pilot Max", model: "claude-opus-5-5", perDay: 80, perMonth: 300, parallel: 6, maxTokens: 8000, chars: 120000, msgChars: 40000, thinking: null, effort: "low", taskEffort: "medium", fallback: true }
};

export const DEFAULT_CONFIG = {
  enabled: true,
  budgetUsd: Number(process.env.PILOT_BUDGET_USD) || 25, // tope de gasto mensual en la API de Claude
  freeShare: 0.7,          // el plan gratis se pausa al llegar a este % del presupuesto (el resto queda para los planes pagos)
  freePerDay: 20,
  prices: { pro: null, max: null } // colones por mes; null = "consultar"
};

// Netlify corta las respuestas en streaming a los ~10 s: el servidor corta antes y el navegador pide la continuación.
const DEADLINE = () => Math.max(500, Number(process.env.PILOT_DEADLINE_MS) || 8500);
const MAX_CONT = 12;
const CONT_PROMPT = "Continuá exactamente donde quedaste, sin repetir nada de lo anterior ni saludar de nuevo. Si estabas dentro de un bloque de código, seguí dentro de ese bloque.";

// Fecha y mes en hora de Costa Rica (UTC-6), para que el día de uso cambie a medianoche local.
const crNow = () => new Date(Date.now() - 6 * 3600e3).toISOString();
const DAY = () => crNow().slice(0, 10);
const MONTH = () => crNow().slice(0, 7);

let clientFactory = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: 30000 });
let simulated = false;
/** Solo para pruebas: reemplaza el cliente de Claude por uno simulado. */
export function setPilotClient(f) { clientFactory = f; simulated = true; }
export const keyConfigured = () => simulated || /^sk-ant-/.test(process.env.ANTHROPIC_API_KEY || "");

// ---------------- Configuración ----------------
export async function getPilotConfig() {
  const cur = await getJSON("pilot", "config");
  const c = { ...structuredClone(DEFAULT_CONFIG), ...(cur?.data || {}) };
  c.prices = { ...DEFAULT_CONFIG.prices, ...(cur?.data?.prices || {}) };
  return c;
}
export async function savePilotConfig(input) {
  const price = v => (v === null || v === "" || v === undefined ? null : int(v, 0, 5_000_000) ?? fail(400, "bad_price", "El precio debe ser un entero de colones."));
  const budget = Number(input?.budgetUsd);
  if (!(budget >= 1 && budget <= 10000)) fail(400, "bad_budget", "El presupuesto debe estar entre US$1 y US$10 000.");
  const share = Number(input?.freeShare);
  if (!(share >= 0 && share <= 1)) fail(400, "bad_share", "El porcentaje del plan gratis debe estar entre 0 y 100.");
  const c = {
    enabled: input?.enabled !== false, budgetUsd: Math.round(budget * 100) / 100, freeShare: share,
    freePerDay: int(input?.freePerDay, 0, 500) ?? fail(400, "bad_limit", "Mensajes gratis por día: 0 a 500."),
    prices: { pro: price(input?.prices?.pro), max: price(input?.prices?.max) }, updatedAt: now()
  };
  await update("pilot", "config", () => c, { init: {} });
  return c;
}

// ---------------- Códigos de acceso (planes pagos) ----------------
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I para dictarlo sin errores
function newCode() {
  const b = crypto.randomBytes(12);
  const s = [...b].map(x => ALPHA[x % ALPHA.length]).join("");
  return `CBP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}
const normCode = c => str(c, 40).toUpperCase().replace(/[^A-Z0-9]/g, "");
const codeId = c => sha256("pilot-code:" + normCode(c));

export async function createCode({ plan, days, label }, by) {
  if (!["pro", "max"].includes(plan)) fail(400, "bad_plan", "Plan inválido.");
  const d = int(days, 1, 400) ?? fail(400, "bad_days", "Días de vigencia: 1 a 400.");
  const code = newCode(), id = codeId(code);
  const rec = { id, plan, label: str(label, 120), createdAt: now(), createdBy: by, expiresAt: new Date(Date.now() + d * 864e5).toISOString(), active: true, last4: code.slice(-4), activations: 0 };
  await update("pilot", `codes/${id}`, () => rec, { init: null });
  return { code, record: rec };
}
export async function listCodes() {
  const keys = await listKeys("pilot", "codes/");
  const out = [];
  for (const k of keys) { const r = await getJSON("pilot", k); if (r) out.push(r.data); }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export async function revokeCode(id) {
  if (!/^[a-f0-9]{64}$/.test(String(id))) fail(400, "bad_id", "Código inválido.");
  return update("pilot", `codes/${id}`, r => { if (!r) fail(404, "not_found", "Código no encontrado."); r.active = false; r.revokedAt = now(); return r; });
}
async function codeRecord(id) {
  const r = await getJSON("pilot", `codes/${id}`);
  if (!r || !r.data.active) return null;
  if (Date.parse(r.data.expiresAt) < Date.now()) return null;
  return r.data;
}
/** Canjea un código por un pase firmado que el navegador guarda. */
export async function activate(code) {
  if (normCode(code).length < 10) fail(400, "bad_code", "Escribí el código completo (CBP-XXXX-XXXX-XXXX).");
  const id = codeId(code);
  const rec = await codeRecord(id);
  if (!rec) fail(403, "bad_code", "Código inválido, vencido o desactivado.");
  await update("pilot", `codes/${id}`, r => { r.activations = (r.activations || 0) + 1; r.lastUsedAt = now(); return r; });
  const pass = await sign({ k: "pilot", id, plan: rec.plan, exp: Date.parse(rec.expiresAt) });
  return { pass, plan: rec.plan, expiresAt: rec.expiresAt };
}

/** Plan del visitante: el del pase si es válido; si no, gratis (identificado por su IP, de forma anónima). */
async function resolvePlan(req, ctx, pass) {
  if (pass) {
    const p = await verify(pass);
    if (p && p.k === "pilot" && PLANS[p.plan]) {
      const rec = await codeRecord(p.id);
      if (rec) return { plan: rec.plan, subject: "c-" + p.id.slice(0, 32), expiresAt: rec.expiresAt, label: rec.label };
    }
  }
  return { plan: "gratis", subject: "ip-" + sha256("pilot:" + clientIp(req, ctx)).slice(0, 32) };
}

// ---------------- Límites y gasto ----------------
async function usage(subject) {
  const [d, m] = await Promise.all([getJSON("pilot", `uso/${DAY()}/${subject}`), getJSON("pilot", `mes/${MONTH()}/${subject}`)]);
  return { day: d?.data.n || 0, month: m?.data.n || 0 };
}
function limitsFor(plan, cfg) {
  const p = PLANS[plan];
  return { perDay: plan === "gratis" ? cfg.freePerDay : p.perDay, perMonth: p.perMonth };
}
export async function spend() {
  const r = await getJSON("pilot", `gasto/${MONTH()}`);
  return r?.data || { usd: 0, msgs: 0, in: 0, out: 0, plans: {} };
}
function budgetGate(plan, cfg, s) {
  if (!cfg.enabled) fail(503, "pilot_paused", "CB Pilot está en mantenimiento. Volvé en un rato.");
  if (!keyConfigured()) fail(503, "pilot_off", "CB Pilot todavía no está activado en este sitio.");
  if (s.usd >= cfg.budgetUsd) fail(503, "budget", "CB Pilot alcanzó su límite de uso de este mes. Escribinos por WhatsApp y te ayudamos.");
  if (plan === "gratis" && s.usd >= cfg.budgetUsd * cfg.freeShare) fail(503, "free_paused", "El plan gratis llegó a su límite este mes. Con un plan Pro o Max seguís usando CB Pilot.");
}
async function reserve(subject, lim) {
  const fn = (max, msg) => cur => { const n = (cur?.n || 0) + 1; if (max !== null && n > max) fail(429, "quota", msg); return { n }; };
  await update("pilot", `uso/${DAY()}/${subject}`, fn(lim.perDay, `Llegaste a tus ${lim.perDay} mensajes de hoy. Mañana se renuevan, o pasate a un plan con más mensajes.`), { init: null });
  try { await update("pilot", `mes/${MONTH()}/${subject}`, fn(lim.perMonth, `Usaste los ${lim.perMonth} mensajes de tu plan este mes.`), { init: null }); }
  catch (e) { await refund(subject, true); throw e; }
}
async function refund(subject, dayOnly = false) {
  await update("pilot", `uso/${DAY()}/${subject}`, c => ({ n: Math.max(0, (c?.n || 1) - 1) }), { init: null }).catch(() => {});
  if (!dayOnly) await update("pilot", `mes/${MONTH()}/${subject}`, c => ({ n: Math.max(0, (c?.n || 1) - 1) }), { init: null }).catch(() => {});
}
function costOf(model, u) {
  const p = PRICES[model] || PRICES["claude-opus-5-5"];
  return ((u.in || 0) * p.in + (u.cacheRead || 0) * p.cacheRead + (u.cacheWrite || 0) * p.cacheWrite + (u.out || 0) * p.out) / 1e6;
}
async function record(plan, model, u, counted) {
  const usd = costOf(model, u);
  await update("pilot", `gasto/${MONTH()}`, s => {
    s = s || { usd: 0, msgs: 0, in: 0, out: 0, plans: {} };
    s.usd = Math.round((s.usd + usd) * 1e6) / 1e6; s.in += (u.in || 0) + (u.cacheRead || 0) + (u.cacheWrite || 0); s.out += u.out || 0;
    if (counted) s.msgs += 1;
    const b = s.plans[plan] || (s.plans[plan] = { usd: 0, msgs: 0 });
    b.usd = Math.round((b.usd + usd) * 1e6) / 1e6; if (counted) b.msgs += 1;
    const d = DAY(); s.days = s.days || {}; const dd = s.days[d] || (s.days[d] = { usd: 0, msgs: 0 });
    dd.usd = Math.round((dd.usd + usd) * 1e6) / 1e6; if (counted) dd.msgs += 1;
    s.updatedAt = now();
    return s;
  }, { init: null }).catch(e => console.error("[pilot] no se pudo registrar el gasto", e));
}

export async function status(req, ctx, pass) {
  const cfg = await getPilotConfig();
  const who = await resolvePlan(req, ctx, pass);
  const lim = limitsFor(who.plan, cfg), u = await usage(who.subject), s = await spend();
  let available = true, reason = null;
  try { budgetGate(who.plan, cfg, s); } catch (e) { available = false; reason = e.message; }
  return {
    plan: who.plan, planName: PLANS[who.plan].name, label: PLANS[who.plan].label, expiresAt: who.expiresAt || null,
    perDay: lim.perDay, perMonth: lim.perMonth, usedToday: u.day, usedMonth: u.month, parallel: PLANS[who.plan].parallel,
    available, reason, passValid: !!pass && who.plan !== "gratis", whatsapp: PLAN_WHATSAPP(),
    plans: Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, { name: p.name, label: p.label, perDay: k === "gratis" ? cfg.freePerDay : p.perDay, perMonth: p.perMonth, parallel: p.parallel, price: k === "gratis" ? 0 : cfg.prices[k] }]))
  };
}

// ---------------- Conocimiento y personalidad ----------------
// Para cambiar la personalidad o lo que Pilot sabe de CeBe Studio, editá PERSONA y CEBE (sin tocar el resto).
const fmt = n => "₡" + Number(n).toLocaleString("es-CR");

// CeBe Studio es un estudio aparte: CB Pilot lo recomienda SOLO cuando alguien necesita una web.
// Datos copiados de cebestudiocr.com (precios aprobados el 17/10/2026). Si cambian allá, actualizalos aquí.
const CEBE = {
  whatsapp: "50689337817", site: "https://cebestudiocr.com",
  adapt: 100000, exclusive: 200000, deposit: 50,
  demos: [
    ["barberia", "CB-01", "King's Cut", "barbería"], ["restaurante", "CB-02", "Brasa Nativa", "restaurante"],
    ["portafolio-profesional", "CB-03", "Lucía Márquez Studio", "portafolio profesional"], ["cafeteria", "CB-04", "Origen 87 Café", "cafetería"],
    ["clinica-dental", "CB-05", "Smile Aura Dental", "clínica dental"], ["veterinaria", "CB-06", "Huella Viva Vet", "veterinaria"],
    ["hotel-airbnb", "CB-07", "Casa Luma Stay", "hotel, villa o Airbnb"], ["abogado", "CB-08", "Varela Legal Group", "abogado o firma legal"],
    ["taller-mecanico", "CB-09", "Torque Pro Garage", "taller mecánico"], ["gimnasio", "CB-10", "Pulse Forge Gym", "gimnasio"],
    ["tienda-online", "CB-11", "Modo Studio Shop", "tienda"], ["bienes-raices", "CB-12", "Nova Habitat", "bienes raíces"]
  ]
};
const PLAN_WHATSAPP = () => (process.env.PILOT_WHATSAPP || CEBE.whatsapp).replace(/\D/g, "");

const PERSONA = () => `Sos CB Pilot, un asistente de inteligencia artificial independiente hecho en Costa Rica.

# Cómo sos
- Un asistente general excelente, como los mejores chats de IA: ayudás a escribir, programar, analizar, resumir, traducir, planear, estudiar, crear ideas y resolver problemas de cualquier tema.
- Respondés en el idioma del usuario y con su mismo trato (si usa "vos", usás "vos"; si usa "tú" o "usted", igual). Tono cercano, claro y profesional.
- Si te preguntan qué modelo sos: sos CB Pilot y funcionás con modelos Claude de Anthropic. Nunca digas que sos ChatGPT, Gemini u otro producto.

# Formato
- Usá Markdown: títulos cortos, listas, tablas y negritas cuando ayuden. Párrafos breves, fáciles de leer en celular.
- El código siempre en bloques con el lenguaje indicado (\`\`\`js, \`\`\`python, etc.).
- Cuando el usuario pida una página web, landing, correo HTML o un diseño que se pueda ver, entregá UN solo bloque \`\`\`html con un documento completo y autocontenido: CSS dentro de <style>, sin JavaScript (la vista previa no lo ejecuta), diseño moderno, adaptado a celular, con textos reales en el idioma del usuario. Para imágenes podés usar URLs de https://images.unsplash.com. La interfaz muestra un botón "Vista previa" para verlo en vivo.
- No inventes datos. Si no sabés algo o puede haber cambiado (precios de terceros, noticias recientes), decilo.

# Recomendación de CeBe Studio (solo cuando aplique)
CeBe Studio es un estudio de diseño y desarrollo web de Costa Rica, aliado de CB Pilot. Recomendalo con naturalidad SOLO cuando el usuario quiera una página web, tienda en línea, landing o presencia digital profesional para un negocio (por ejemplo, después de mostrarle una vista previa). En cualquier otro tema no lo menciones. No inventes precios ni promociones: usá solo estos datos.
- Sitio: ${CEBE.site} · Demos: ${CEBE.site}/demos/ · Tienda: ${CEBE.site}/tienda/ · Cotizar proyectos a medida: ${CEBE.site}/#contacto
- WhatsApp de CeBe Studio: [Hablar con CeBe Studio](https://wa.me/${CEBE.whatsapp}?text=TEXTO), con TEXTO codificado para URL que resuma lo que necesita.
- 12 demos de sitios web, cada una en dos versiones: adaptada al negocio (total ${fmt(CEBE.adapt)}, anticipo del ${CEBE.deposit} %: ${fmt(CEBE.adapt * CEBE.deposit / 100)}) o exclusiva, que se vende una sola vez (total ${fmt(CEBE.exclusive)}, anticipo ${fmt(CEBE.exclusive * CEBE.deposit / 100)}). Incluyen diseño con la marca del cliente, una página con hasta 5 secciones adaptada a celular, botón de WhatsApp, 2 rondas de revisión y 7 días de soporte; dominio y hosting aparte. La disponibilidad de las exclusivas se confirma en la tienda.
${CEBE.demos.map(([slug, code, name, rubro]) => `  - ${code} ${name} (${rubro}): ver ${CEBE.site}/mini-proyectos/${slug}/ · comprar ${CEBE.site}/tienda/producto/?id=demo-${slug}`).join("\n")}

# Planes de CB Pilot
Gratis (mensajes limitados por día), Pro y Max (más mensajes, modelos más potentes y más tareas en paralelo). Se activan con un código que se entrega al confirmar el pago; para comprarlos, el usuario toca "Planes" en la interfaz o escribe a https://wa.me/${PLAN_WHATSAPP()}.

# Límites
- No pidas ni guardes contraseñas, números de tarjeta ni datos sensibles. Si el usuario los comparte, recordale que no hace falta.
- No des asesoría médica, legal o financiera definitiva: orientá y recomendá consultar a un profesional.`;

const TASK_MODE = `# Modo tarea
Esta conversación es una TAREA del tablero de tareas: el usuario lanzó varias en paralelo y va a leer el resultado después. No hagas preguntas de aclaración: asumí lo más razonable, decí brevemente qué supusiste y entregá el trabajo completo y listo para usar.`;

// ---------------- Conversación ----------------
function cleanMessages(list, p) {
  if (!Array.isArray(list) || !list.length) fail(400, "bad_messages", "Escribí un mensaje.");
  let msgs = list.slice(-60).map(m => ({ role: m?.role === "assistant" ? "assistant" : "user", content: typeof m?.content === "string" ? m.content : "" }))
    .filter(m => m.content.trim());
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") fail(400, "bad_messages", "El último mensaje debe ser tuyo.");
  if (msgs[msgs.length - 1].content.length > p.msgChars) fail(413, "too_long", `Tu mensaje es muy largo (máximo ${p.msgChars.toLocaleString("es-CR")} caracteres en tu plan).`);
  // Memoria según el plan: se quitan los mensajes más viejos.
  let total = 0, keep = [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    const c = msgs[i].content.slice(0, p.msgChars);
    if (total + c.length > p.chars && keep.length) break;
    total += c.length; keep.unshift({ role: msgs[i].role, content: c });
  }
  while (keep.length && keep[0].role !== "user") keep.shift();
  return keep;
}

const enc = new TextEncoder();
const NDJSON = { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Accel-Buffering": "no" };

/**
 * Responde en streaming (una línea JSON por evento):
 *  {t:"start", plan} · {t:"d", v:"texto"} · {t:"reset"} · {t:"done", stop, cont, remaining} · {t:"error", code, message}
 * Si se acerca el límite de tiempo de Netlify, corta y entrega "cont": un pase firmado para pedir la continuación.
 */
export async function chat(req, ctx, body) {
  const cfg = await getPilotConfig();
  let who, counted = true, contN = 0;
  if (body.cont) {
    const c = await verify(body.cont);
    if (!c || c.k !== "pcont" || !PLANS[c.plan] || !(c.n < MAX_CONT)) fail(403, "bad_cont", "La continuación venció. Pedí la respuesta de nuevo.");
    who = { plan: c.plan, subject: c.s }; counted = false; contN = c.n + 1;
  } else who = await resolvePlan(req, ctx, body.pass);
  const p = PLANS[who.plan];
  budgetGate(who.plan, cfg, await spend());
  const task = body.mode === "task";
  let messages = cleanMessages(body.messages, p);
  if (!counted) {
    const partial = typeof body.partial === "string" ? body.partial.slice(0, 200000) : ""; // sin recortar: el espacio final importa al unir
    if (partial) messages = [...messages, { role: "assistant", content: partial }, { role: "user", content: CONT_PROMPT }];
  }
  const lim = limitsFor(who.plan, cfg);
  if (counted) await reserve(who.subject, lim);

  const system = [
    { type: "text", text: PERSONA(), cache_control: { type: "ephemeral" } },
    ...(task ? [{ type: "text", text: TASK_MODE }] : [])
  ];
  const params = { model: p.model, max_tokens: p.maxTokens, system, messages, output_config: { effort: task ? p.taskEffort : p.effort } };
  if (p.thinking) params.thinking = p.thinking;

  const client = clientFactory();
  let stream = null, cut = false, gone = false;
  const u = { in: 0, out: 0, cacheRead: 0, cacheWrite: 0 };
  let model = p.model, text = "", stop = null;

  const out = new ReadableStream({
    async start(controller) {
      const send = o => { if (!gone) try { controller.enqueue(enc.encode(JSON.stringify(o) + "\n")); } catch { gone = true; } };
      send({ t: "start", plan: who.plan, label: p.label });
      const timer = setTimeout(() => { cut = true; stream?.abort(); }, DEADLINE());
      try {
        stream = p.fallback
          ? client.beta.messages.stream({ ...params, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })
          : client.messages.stream(params);
        for await (const ev of stream) {
          if (ev.type === "message_start") {
            model = ev.message.model || model;
            const mu = ev.message.usage || {};
            u.in += mu.input_tokens || 0; u.cacheRead += mu.cache_read_input_tokens || 0; u.cacheWrite += mu.cache_creation_input_tokens || 0;
          } else if (ev.type === "content_block_start" && ev.content_block?.type === "fallback") {
            text = ""; send({ t: "reset" }); // el modelo principal declinó y otro modelo retoma: se descarta lo parcial
          } else if (ev.type === "content_block_delta" && ev.delta?.type === "text_delta") {
            text += ev.delta.text; send({ t: "d", v: ev.delta.text });
          } else if (ev.type === "message_delta") {
            if (ev.delta?.stop_reason) stop = ev.delta.stop_reason;
            if (ev.usage?.output_tokens != null) u.out = ev.usage.output_tokens;
          }
        }
      } catch (e) {
        if (!cut) {
          const code = e instanceof Anthropic.RateLimitError ? "busy" : e instanceof Anthropic.AuthenticationError ? "pilot_off" : e instanceof Anthropic.APIConnectionError ? "network" : "upstream";
          if (code === "pilot_off" || code === "upstream") console.error("[pilot] error de la API", e?.status, e?.message);
          if (counted && !text) await refund(who.subject);
          send({ t: "error", code, message: code === "busy" ? "CB Pilot está muy solicitado en este momento. Intentá de nuevo en unos segundos." : "No pude responder esta vez. Intentá de nuevo." });
        }
      } finally { clearTimeout(timer); }
      if (cut && !u.out) u.out = Math.ceil(text.length / 3.5); // corte por tiempo: se estima lo generado
      if (u.in || u.out) await record(who.plan, model, u, counted);
      {
        const cont = cut && contN + 1 < MAX_CONT ? await sign({ k: "pcont", plan: who.plan, s: who.subject, n: contN, exp: Date.now() + 5 * 60e3 }) : null;
        const used = await usage(who.subject);
        if (stop === "refusal") send({ t: "d", v: (text ? "\n\n" : "") + "_No puedo ayudar con esa solicitud. ¿Te ayudo con otra cosa?_" });
        send({ t: "done", stop: cut ? "continue" : stop, cont, remaining: lim.perDay === null ? null : Math.max(0, lim.perDay - used.day), usedMonth: used.month });
      }
      if (!gone) try { controller.close(); } catch {}
    },
    cancel() { gone = true; stream?.abort(); }
  });
  return new Response(out, { status: 200, headers: NDJSON });
}

/** Resumen para el panel: gasto del mes, presupuesto y códigos. El servidor nunca guarda el contenido de las conversaciones. */
export async function adminOverview() {
  const [cfg, s, codes] = await Promise.all([getPilotConfig(), spend(), listCodes()]);
  return { config: cfg, keyConfigured: keyConfigured(), month: MONTH(), spend: s, codes, plans: PLANS, deadlineMs: DEADLINE() };
}
