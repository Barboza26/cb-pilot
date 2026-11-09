// Pagos en línea con ONVO (tarjeta y SINPE Móvil): el cliente paga en la página de ONVO y el plan se activa solo.
//
// Variables de entorno (Netlify):
//   ONVO_SECRET_KEY      llave secreta de ONVO (onvo_test_secret_key_… en pruebas, onvo_live_… en real)
//   ONVO_WEBHOOK_SECRET  secreto del webhook que da ONVO al registrar https://SU-SITIO/api/pay/webhook
//   ONVO_PRICE_PRO       ID del precio del plan Pro creado en ONVO (Productos)
//   ONVO_PRICE_MAX       ID del precio del plan Max creado en ONVO (Productos)
//
// Flujo: /api/pay/checkout crea un enlace de pago y guarda el pedido (pagos/<id>) con la cuenta y el plan.
// ONVO avisa a /api/pay/webhook con «checkout-session.succeeded»; si el secreto coincide y el pedido existe
// y sigue pendiente, se suman 30 días del plan a la cuenta. Un pedido se aplica una sola vez.
import crypto from "node:crypto";
import { getJSON, putJSON, update } from "./db.mjs";
import { fail, now } from "./util.mjs";
import { setPlan, activePlan } from "./users.mjs";

const API = () => (process.env.ONVO_API_URL || "https://api.onvopay.com").replace(/\/$/, "");
const PRICE = { pro: () => process.env.ONVO_PRICE_PRO, max: () => process.env.ONVO_PRICE_MAX };
const DAYS = 30;
let fetchImpl = (...a) => fetch(...a);
/** Solo para pruebas: reemplaza fetch para simular a ONVO. */
export function setPayFetch(f) { fetchImpl = f; }

/** Qué planes se pueden pagar en línea (si falta alguna variable, ese plan sigue por WhatsApp). */
export function payOnline() {
  const base = !!process.env.ONVO_SECRET_KEY && !!process.env.ONVO_WEBHOOK_SECRET;
  return { pro: base && !!PRICE.pro(), max: base && !!PRICE.max() };
}

async function onvo(method, path, body) {
  let res;
  try {
    res = await fetchImpl(API() + path, {
      method,
      headers: { Authorization: `Bearer ${process.env.ONVO_SECRET_KEY}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (e) {
    console.error("[pagos] sin conexión con ONVO", e?.message);
    fail(502, "pay_unavailable", "No pudimos conectar con el sistema de pagos. Intente de nuevo en un momento.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[pagos] ONVO respondió", res.status, JSON.stringify(data).slice(0, 500));
    fail(502, "pay_unavailable", "El sistema de pagos no respondió bien. Intente de nuevo o escríbanos por WhatsApp.");
  }
  return data;
}

/** Crea el enlace de pago de ONVO para una cuenta. Devuelve { url }. */
export async function createCheckout(user, plan, origin) {
  if (!user) fail(401, "login_required", "Inicie sesión o cree una cuenta gratis para comprar un plan.");
  if (!["pro", "max"].includes(plan)) fail(400, "bad_plan", "Plan inválido.");
  if (!payOnline()[plan]) fail(503, "pay_off", "El pago en línea todavía no está activado. Escríbanos por WhatsApp.");
  const base = String(origin || "").replace(/\/$/, "");
  const s = await onvo("POST", "/v1/checkout/sessions/one-time-link", {
    lineItems: [{ priceId: PRICE[plan](), quantity: 1 }],
    redirectUrl: `${base}/?pago=ok`,
    cancelUrl: `${base}/?pago=cancelado`
  });
  const id = s.id, url = s.url || s.checkoutUrl || s.link;
  if (!id || !url) { console.error("[pagos] respuesta inesperada de ONVO", JSON.stringify(s).slice(0, 500)); fail(502, "pay_unavailable", "El sistema de pagos no respondió bien. Intente de nuevo."); }
  await putJSON("pagos", `p/${id}`, { id, userId: user.id, email: user.email, plan, status: "pending", createdAt: now() });
  return { url };
}

const sameSecret = (a, b) => {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y);
};

/** Aviso de ONVO. Devuelve { handled, plan?, userId? }. */
export async function handleWebhook(req, body) {
  if (!process.env.ONVO_WEBHOOK_SECRET || !sameSecret(req.headers.get("x-webhook-secret"), process.env.ONVO_WEBHOOK_SECRET)) fail(401, "bad_secret", "Secreto inválido.");
  if (body?.type !== "checkout-session.succeeded") return { handled: false }; // otros eventos: se aceptan y se ignoran
  const id = body?.data?.id;
  if (!id) return { handled: false };
  const rec = await getJSON("pagos", `p/${id}`);
  if (!rec || rec.data.status !== "pending") return { handled: false }; // pedido desconocido o ya aplicado (ONVO puede reintentar)
  let applied = null;
  await update("pagos", `p/${id}`, cur => {
    if (!cur || cur.status !== "pending") return cur; // pedido desconocido o ya aplicado: no hace nada (ONVO puede reintentar)
    applied = cur;
    return { ...cur, status: "paid", paidAt: now() };
  }).catch(e => { if (e?.status !== 409) throw e; });
  if (!applied) return { handled: false };
  // Suma 30 días: si ya tiene ese plan vigente, a partir del vencimiento; si no, desde hoy.
  const u = (await getJSON("users", `u/${applied.userId}`))?.data;
  if (!u) { console.error("[pagos] pago de una cuenta que ya no existe", applied.userId, id); return { handled: false }; }
  const from = activePlan(u) === applied.plan ? Date.parse(u.planExpiresAt) : Date.now();
  await setPlan(u.id, applied.plan, new Date(from + DAYS * 864e5).toISOString(), null);
  return { handled: true, plan: applied.plan, userId: u.id };
}
