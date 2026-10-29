// API de CB Pilot (una sola función con rutas internas): chat, planes y panel de administración.
import { setNamespaceFromHost, currentNamespace } from "../lib/db.mjs";
import { adminExists, setupAdmin, login, logoutCookie, requireAdmin, changePassword } from "../lib/admin.mjs";
import { status, activate, chat, adminOverview, savePilotConfig, createCode, revokeCode, keyConfigured } from "../lib/pilot.mjs";
import { audit, recent } from "../lib/log.mjs";
import * as kb from "../lib/knowledge.mjs";
import * as users from "../lib/users.mjs";
import { json, errorResponse, readJSON, fail, rateLimit, sameOrigin, str, now } from "../lib/util.mjs";

export const config = { path: "/api/*" };

const routes = {
  "GET /api/health": async () => json({ ok: true, environment: currentNamespace() ? "preview" : "production", ai: keyConfigured(), time: now() }),

  // ---------------- Chat y planes ----------------
  "POST /api/pilot/status": async (req, ctx) => {
    await rateLimit(req, ctx, "pilot-status", 120, 600);
    const b = await readJSON(req);
    return json({ ok: true, ...(await status(req, ctx, str(b.pass, 2000))) });
  },
  "POST /api/pilot/activate": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "pilot-activate", 10, 900);
    const r = await activate((await readJSON(req)).code, await users.currentUser(req));
    await audit("cliente", "pilot_activated", r.plan);
    return json({ ok: true, ...r });
  },
  // Respuesta en streaming (NDJSON). Los errores previos (límite, presupuesto) se devuelven como JSON normal.
  "POST /api/pilot/chat": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "pilot-chat", 40, 60);
    return chat(req, ctx, await readJSON(req, 6 * 1024 * 1024)); // incluye fotos y archivos adjuntos
  },

  // ---------------- Cuentas de clientes ----------------
  "POST /api/account/register": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "register", 5, 3600);
    const r = await users.register(await readJSON(req));
    await audit(r.user.email, "account_created", r.user.id);
    return json({ ok: true, user: users.publicUser(r.user) }, 200, { "Set-Cookie": r.cookie });
  },
  "POST /api/account/login": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "user-login", 10, 900);
    const r = await users.login(await readJSON(req));
    return json({ ok: true, user: users.publicUser(r.user) }, 200, { "Set-Cookie": r.cookie });
  },
  "POST /api/account/logout": async () => json({ ok: true }, 200, { "Set-Cookie": users.logoutCookie() }),
  "GET /api/account/me": async req => json({ ok: true, user: users.publicUser(await users.currentUser(req)) || null }),
  "POST /api/account/profile": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const u = await users.updateProfile(await users.requireUser(req), await readJSON(req));
    return json({ ok: true, user: users.publicUser(u) });
  },
  "POST /api/account/password": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "user-password", 5, 900);
    const b = await readJSON(req);
    const r = await users.changePassword(await users.requireUser(req), b.current, b.next);
    return json({ ok: true }, 200, { "Set-Cookie": r.cookie });
  },
  "POST /api/account/delete": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "user-delete", 5, 900);
    const u = await users.requireUser(req);
    await users.deleteAccount(u, (await readJSON(req)).password);
    await audit(u.email, "account_deleted", u.id);
    return json({ ok: true }, 200, { "Set-Cookie": users.logoutCookie() });
  },

  // ---------------- Administración ----------------
  "GET /api/admin/status": async () => json({ ok: true, exists: await adminExists(), setupAvailable: (process.env.ADMIN_SETUP_CODE || "").length >= 12 }),
  "POST /api/admin/setup": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "setup", 5, 3600);
    await setupAdmin(await readJSON(req));
    await audit("sistema", "admin_setup", "admin");
    return json({ ok: true });
  },
  "POST /api/admin/login": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "login", 6, 900);
    const b = await readJSON(req);
    const cookie = await login(b).catch(async e => { await audit("anon", "login_failed", str(b.email, 80)); throw e; });
    await audit(str(b.email, 80), "login", "admin");
    return json({ ok: true }, 200, { "Set-Cookie": cookie });
  },
  "POST /api/admin/logout": async () => json({ ok: true }, 200, { "Set-Cookie": logoutCookie() }),
  "GET /api/admin/me": async req => json({ ok: true, admin: await requireAdmin(req) }),
  "POST /api/admin/password": async (req, ctx) => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    await rateLimit(req, ctx, "password", 5, 900);
    const admin = await requireAdmin(req);
    const b = await readJSON(req);
    await changePassword(admin.email, b.current, b.next);
    await audit(admin.email, "password_changed", "admin");
    return json({ ok: true }, 200, { "Set-Cookie": logoutCookie() });
  },
  "GET /api/admin/audit": async req => { await requireAdmin(req); return json({ ok: true, items: await recent("audit", 200) }); },
  "GET /api/admin/pilot": async req => { await requireAdmin(req); return json({ ok: true, ...(await adminOverview()) }); },
  "POST /api/admin/pilot/config": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const c = await savePilotConfig((await readJSON(req)).config);
    await audit(admin.email, "pilot_config", "pilot", { enabled: c.enabled, budgetUsd: c.budgetUsd });
    return json({ ok: true, config: c });
  },
  "POST /api/admin/pilot/code": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const r = await createCode(await readJSON(req), admin.email);
    await audit(admin.email, "pilot_code_created", r.record.id.slice(0, 12), { plan: r.record.plan, label: r.record.label });
    return json({ ok: true, code: r.code, record: r.record });
  },
  // ---------------- Usuarios (panel) ----------------
  "GET /api/admin/users": async req => { await requireAdmin(req); return json({ ok: true, users: await users.listUsers() }); },
  "POST /api/admin/users/action": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const b = await readJSON(req);
    const r = await users.adminAction(b.id, str(b.action, 20), { plan: b.plan, days: b.days });
    await audit(admin.email, `user_${str(b.action, 20)}`, str(b.id, 40), b.action === "plan" ? { plan: b.plan, days: b.days } : {});
    return json({ ok: true, user: r.user ? users.publicUser(r.user) : null, tempPassword: r.tempPassword || null });
  },

  // ---------------- Base de conocimiento ----------------
  "GET /api/admin/knowledge": async req => { await requireAdmin(req); return json({ ok: true, ...(await kb.stats()) }); },
  "GET /api/admin/knowledge/source": async req => { await requireAdmin(req); return json({ ok: true, ...(await kb.preview(str(new URL(req.url).searchParams.get("id"), 40))) }); },
  // Hasta 5 enlaces por envío; cada uno se resuelve por separado (uno que falle no frena a los demás).
  "POST /api/admin/knowledge/url": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const b = await readJSON(req);
    const urls = [...new Set((Array.isArray(b.urls) ? b.urls : []).map(u => str(u, 2000)).filter(Boolean))];
    if (!urls.length) fail(400, "no_urls", "Pegá al menos un enlace.");
    if (urls.length > 5) fail(400, "too_many", "Máximo 5 enlaces por envío.");
    const results = [];
    for (const url of urls) { // de a uno: cada fuente reconstruye el índice
      try { const r = await kb.addUrl(url); results.push({ url, ok: true, source: r }); await audit(admin.email, "knowledge_url", r.id, { url: r.url, chars: r.chars }); }
      catch (e) { results.push({ url, ok: false, message: e.message || "Error" }); }
    }
    return json({ ok: true, results });
  },
  "POST /api/admin/knowledge/file": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    if (Number(req.headers.get("content-length") || 0) > 5.2 * 1024 * 1024) fail(413, "too_large", "El archivo supera 5 MB.");
    const form = await req.formData().catch(() => fail(400, "bad_form", "Formulario inválido."));
    const file = form.get("file");
    if (!file || typeof file === "string") fail(400, "no_file", "Elegí un archivo.");
    const name = String(file.name || "archivo").normalize("NFC").replace(/[\\/:*?"<>|]+/g, "").slice(-120) || "archivo";
    const r = await kb.addFile(name, await file.arrayBuffer());
    await audit(admin.email, "knowledge_file", r.id, { name, chars: r.chars });
    return json({ ok: true, source: r });
  },
  "POST /api/admin/knowledge/text": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const b = await readJSON(req, 512 * 1024);
    const r = await kb.addText(b.title, b.text);
    await audit(admin.email, "knowledge_text", r.id, { title: r.title, chars: r.chars });
    return json({ ok: true, source: r });
  },
  "POST /api/admin/knowledge/refresh": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const r = await kb.refresh(str((await readJSON(req)).id, 40));
    await audit(admin.email, "knowledge_refresh", r.id, { url: r.url, chars: r.chars });
    return json({ ok: true, source: r });
  },
  "POST /api/admin/knowledge/active": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const b = await readJSON(req);
    const r = await kb.setActive(str(b.id, 40), b.active === true);
    await audit(admin.email, r.active ? "knowledge_on" : "knowledge_off", r.id);
    return json({ ok: true, source: r });
  },
  "POST /api/admin/knowledge/delete": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const id = str((await readJSON(req)).id, 40);
    await kb.remove(id);
    await audit(admin.email, "knowledge_deleted", id);
    return json({ ok: true });
  },
  "POST /api/admin/knowledge/search": async req => { await requireAdmin(req); return json({ ok: true, results: await kb.testSearch((await readJSON(req)).q) }); },

  "POST /api/admin/pilot/revoke": async req => {
    if (!sameOrigin(req)) fail(403, "bad_origin", "Origen no permitido.");
    const admin = await requireAdmin(req);
    const r = await revokeCode(str((await readJSON(req)).id, 64));
    await audit(admin.email, "pilot_code_revoked", r.id.slice(0, 12));
    return json({ ok: true, record: r });
  }
};

export default async (req, context) => {
  try {
    const url = new URL(req.url);
    setNamespaceFromHost(url.host);
    const path = url.pathname.replace(/\/+$/, "");
    const h = routes[`${req.method} ${path}`];
    if (!h) return json({ ok: false, error: "not_found" }, 404);
    return await h(req, context);
  } catch (e) { return errorResponse(e); }
};

export { routes };
