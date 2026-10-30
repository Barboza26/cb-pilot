// Cuentas de clientes de CeBe Pilot: registro con correo y contraseña, sesión con cookie firmada y plan guardado en la cuenta.
// La contraseña se guarda con scrypt (nunca en claro). El contenido de los chats NO se guarda: sigue en el dispositivo.
import { getJSON, putJSON, update, listKeys, del } from "./db.mjs";
import { fail, hashPassword, verifyPassword, sign, verify, cookies, isEmail, str, sha256, randomToken, now, int } from "./util.mjs";

const COOKIE = "cbpilot_user";
const TTL = 30 * 864e5; // 30 días
const PAID = ["pro", "max"];
const emailKey = mail => `email/${sha256("cbpilot-user:" + mail)}`;
const normEmail = e => str(e, 160).toLowerCase();

/** Plan vigente de la cuenta ("gratis" si no tiene o ya venció). */
export const activePlan = u => (u && PAID.includes(u.plan) && u.planExpiresAt && Date.parse(u.planExpiresAt) > Date.now() ? u.plan : "gratis");
/** Lo que se puede mostrar del usuario (nunca el hash ni datos internos). */
export const publicUser = u => u && { id: u.id, name: u.name, email: u.email, plan: activePlan(u), planExpiresAt: activePlan(u) === "gratis" ? null : u.planExpiresAt, createdAt: u.createdAt };

async function cookieFor(u) {
  const t = await sign({ k: "user", sub: u.id, v: u.sessionVersion, exp: Date.now() + TTL });
  return `${COOKIE}=${encodeURIComponent(t)}; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=${TTL / 1000}`;
}
export const logoutCookie = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;

function checkPassword(pw) {
  if (typeof pw !== "string" || pw.length < 8) fail(400, "weak_password", "La contraseña debe tener al menos 8 caracteres.");
  if (pw.length > 200) fail(400, "weak_password", "La contraseña es demasiado larga.");
}
async function byId(id) { return id ? (await getJSON("users", `u/${id}`))?.data || null : null; }

export async function register({ name, email, password }) {
  const nm = str(name, 80), mail = normEmail(email);
  if (!nm) fail(400, "no_name", "Escribí tu nombre.");
  if (!isEmail(mail)) fail(400, "bad_email", "Correo inválido.");
  checkPassword(password);
  const id = randomToken(10);
  if (!(await putJSON("users", emailKey(mail), { id }, { ifNew: true }))) fail(409, "exists", "Ya existe una cuenta con ese correo. Iniciá sesión.");
  const u = { id, name: nm, email: mail, hash: hashPassword(password), sessionVersion: 1, plan: null, planExpiresAt: null, planCodeId: null, blocked: false, createdAt: now(), lastLoginAt: now() };
  await putJSON("users", `u/${id}`, u);
  return { user: u, cookie: await cookieFor(u) };
}

export async function login({ email, password }) {
  const mail = normEmail(email);
  const idx = isEmail(mail) ? await getJSON("users", emailKey(mail)) : null;
  const u = await byId(idx?.data.id);
  // Siempre se calcula un hash: el tiempo de respuesta no revela si el correo existe.
  const good = u ? verifyPassword(String(password || ""), u.hash) : (verifyPassword("x", "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA"), false);
  if (!good) fail(401, "bad_login", "Correo o contraseña incorrectos.");
  if (u.blocked) fail(403, "blocked", "Tu cuenta está bloqueada. Escribinos por WhatsApp para ayudarte.");
  const next = await update("users", `u/${u.id}`, x => { x.lastLoginAt = now(); return x; });
  return { user: next, cookie: await cookieFor(next) };
}

/** Usuario de la sesión actual, o null. Una sesión vieja (cambio de contraseña) deja de valer. */
export async function currentUser(req) {
  const p = await verify(cookies(req)[COOKIE]);
  if (!p || p.k !== "user") return null;
  const u = await byId(p.sub);
  return u && u.sessionVersion === p.v ? u : null;
}
export async function requireUser(req) {
  const u = await currentUser(req);
  if (!u) fail(401, "no_session", "Iniciá sesión.");
  return u;
}

export async function updateProfile(u, { name }) {
  const nm = str(name, 80);
  if (!nm) fail(400, "no_name", "Escribí tu nombre.");
  return update("users", `u/${u.id}`, x => { x.name = nm; return x; });
}
export async function changePassword(u, current, next) {
  checkPassword(next);
  const r = await update("users", `u/${u.id}`, x => {
    if (!verifyPassword(String(current || ""), x.hash)) fail(403, "bad_password", "La contraseña actual no coincide.");
    x.hash = hashPassword(next); x.sessionVersion += 1; // cierra las sesiones en otros dispositivos
    return x;
  });
  return { user: r, cookie: await cookieFor(r) };
}
export async function deleteAccount(u, password) {
  if (!verifyPassword(String(password || ""), u.hash)) fail(403, "bad_password", "La contraseña no coincide.");
  await del("users", `u/${u.id}`); await del("users", emailKey(u.email));
}

/** Guarda un plan en la cuenta (por código canjeado o asignado por el dueño). */
export async function setPlan(id, plan, expiresAt, codeId = null) {
  return update("users", `u/${id}`, x => {
    if (!x) fail(404, "not_found", "Usuario no encontrado.");
    x.plan = plan; x.planExpiresAt = expiresAt; x.planCodeId = codeId; x.planUpdatedAt = now();
    return x;
  });
}

// ---------------- Panel del dueño ----------------
export async function listUsers() {
  const out = [];
  for (const k of await listKeys("users", "u/")) { const r = await getJSON("users", k); if (r) out.push(r.data); }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(u => ({ ...publicUser(u), blocked: !!u.blocked, lastLoginAt: u.lastLoginAt, viaCode: !!u.planCodeId, rawPlan: u.plan, rawExpiresAt: u.planExpiresAt }));
}
/** Acciones del dueño sobre una cuenta. Devuelve { user, tempPassword? }. */
export async function adminAction(id, action, data = {}) {
  const u = await byId(str(id, 40));
  if (!u) fail(404, "not_found", "Usuario no encontrado.");
  switch (action) {
    case "plan": {
      if (!PAID.includes(data.plan)) fail(400, "bad_plan", "Plan inválido.");
      const days = int(data.days, 1, 400) ?? fail(400, "bad_days", "Días de vigencia: 1 a 400.");
      // Si ya tiene ese plan vigente, se suman los días; si no, empiezan hoy.
      const base = activePlan(u) === data.plan ? Date.parse(u.planExpiresAt) : Date.now();
      return { user: await setPlan(u.id, data.plan, new Date(base + days * 864e5).toISOString(), null) };
    }
    case "removePlan": return { user: await setPlan(u.id, null, null, null) };
    case "block": return { user: await update("users", `u/${u.id}`, x => { x.blocked = true; x.sessionVersion += 1; return x; }) };
    case "unblock": return { user: await update("users", `u/${u.id}`, x => { x.blocked = false; return x; }) };
    case "resetPassword": {
      // Contraseña temporal para dársela al cliente por WhatsApp (no hay correo configurado todavía).
      const temp = randomToken(9).replace(/[-_]/g, "x");
      const user = await update("users", `u/${u.id}`, x => { x.hash = hashPassword(temp); x.sessionVersion += 1; return x; });
      return { user, tempPassword: temp };
    }
    case "delete": await del("users", `u/${u.id}`); await del("users", emailKey(u.email)); return { user: null };
    default: fail(400, "bad_action", "Acción inválida.");
  }
}
