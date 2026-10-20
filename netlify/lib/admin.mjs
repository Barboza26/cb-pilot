// Autenticación del panel de administración.
// Primer acceso: requiere ADMIN_SETUP_CODE (variable de entorno que define el dueño en Netlify).
// La contraseña se guarda con scrypt; la sesión es una cookie HttpOnly firmada en el servidor.
import { getJSON, putJSON, update } from "./db.mjs";
import { fail, hashPassword, verifyPassword, sign, verify, cookies, safeEqual, isEmail, str, now, randomToken } from "./util.mjs";

const COOKIE = "cbpilot_admin";
const TTL = 8 * 3600e3; // 8 horas

export async function adminExists() { return !!(await getJSON("system", "admin")); }

export async function setupAdmin({ code, email, password }) {
  const expected = process.env.ADMIN_SETUP_CODE || "";
  if (expected.length < 12) fail(503, "setup_disabled", "Falta definir ADMIN_SETUP_CODE (mínimo 12 caracteres) en Netlify.");
  if (!safeEqual(String(code || ""), expected)) fail(403, "bad_code", "Código de configuración incorrecto.");
  const mail = str(email, 160).toLowerCase();
  if (!isEmail(mail)) fail(400, "bad_email", "Correo inválido.");
  if (typeof password !== "string" || password.length < 12) fail(400, "weak_password", "La contraseña debe tener al menos 12 caracteres.");
  const ok = await putJSON("system", "admin", { email: mail, hash: hashPassword(password), role: "owner", createdAt: now(), sessionVersion: 1 }, { ifNew: true });
  if (!ok) fail(409, "exists", "El administrador ya fue configurado.");
}

export async function login({ email, password }) {
  const a = await getJSON("system", "admin");
  // Siempre se calcula un hash para no revelar si el correo existe por el tiempo de respuesta.
  const good = a && a.data.email === str(email, 160).toLowerCase() && verifyPassword(String(password || ""), a.data.hash);
  if (!a) verifyPassword("x", "scrypt$AAAAAAAAAAAAAAAAAAAAAA$AAAA");
  if (!good) fail(401, "bad_login", "Correo o contraseña incorrectos.");
  const token = await sign({ sub: a.data.email, role: a.data.role, v: a.data.sessionVersion, sid: randomToken(8), exp: Date.now() + TTL });
  return `${COOKIE}=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${TTL / 1000}`;
}
export const logoutCookie = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;

/** Verifica la sesión y el rol en el servidor. Devuelve el administrador o lanza 401/403. */
export async function requireAdmin(req, role = "owner") {
  const p = await verify(cookies(req)[COOKIE]);
  if (!p) fail(401, "no_session", "Iniciá sesión.");
  const a = await getJSON("system", "admin");
  if (!a || a.data.email !== p.sub || a.data.sessionVersion !== p.v) fail(401, "no_session", "La sesión ya no es válida.");
  if (role === "owner" && a.data.role !== "owner") fail(403, "forbidden", "Sin permiso.");
  return { email: a.data.email, role: a.data.role };
}

export async function changePassword(adminEmail, current, next) {
  if (typeof next !== "string" || next.length < 12) fail(400, "weak_password", "La contraseña debe tener al menos 12 caracteres.");
  await update("system", "admin", a => {
    if (!a || a.email !== adminEmail || !verifyPassword(String(current || ""), a.hash)) fail(403, "bad_password", "La contraseña actual no coincide.");
    a.hash = hashPassword(next); a.sessionVersion = (a.sessionVersion || 1) + 1; // cierra las demás sesiones
    return a;
  });
}
