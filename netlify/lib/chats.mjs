// Chats guardados en la cuenta (opcional): solo si la persona activa «Guardar mis chats en mi cuenta».
// Cada chat se guarda cifrado (AES-256-GCM con la clave del servidor) en Netlify Blobs, separado por cuenta.
// Los archivos adjuntos NO se guardan: solo el texto de la conversación y el nombre de los archivos.
import { getJSON, putJSON, listKeys, del } from "./db.mjs";
import { fail, encrypt, decrypt, str } from "./util.mjs";

const MAX_CHATS = 200, MAX_BYTES = 400 * 1024, BATCH = 20;
const key = (uid, id) => `c/${uid}/${id}`;
const cleanId = id => { const s = str(id, 40); if (!/^[\w-]{4,40}$/.test(s)) fail(400, "bad_id", "Chat inválido."); return s; };

function requireSync(u) {
  if (!u) fail(401, "no_session", "Inicie sesión.");
  if (!u.syncChats) fail(403, "sync_off", "Active «Guardar mis chats en mi cuenta» en Configuración.");
}
/** Deja solo lo que hace falta para volver a mostrar el chat (sin fotos ni datos de archivos). */
function clean(c) {
  const msgs = (Array.isArray(c.messages) ? c.messages : []).filter(m => m && (m.role === "user" || m.role === "assistant") && !m.pending).slice(-400).map(m => {
    const o = { role: m.role, content: String(m.content || "") };
    if (m.files?.length) o.files = m.files.slice(0, 5).map(f => ({ kind: str(f.kind, 20), name: str(f.name, 120) }));
    for (const k of ["assistant", "stop", "rating", "fuel", "error", "errorMsg"]) if (m[k] !== undefined && m[k] !== null) o[k] = m[k];
    if (Array.isArray(m.sources)) o.sources = m.sources.slice(0, 10);
    return o;
  });
  return { id: cleanId(c.id), title: str(c.title, 120) || "Chat", created: Number(c.created) || Date.now(), updated: Number(c.updated) || Date.now(), pinned: !!c.pinned, assistant: str(c.assistant, 30) || undefined, messages: msgs };
}

export async function listChats(u) {
  requireSync(u);
  const out = [];
  for (const k of await listKeys("chats", `c/${u.id}/`)) {
    const r = await getJSON("chats", k);
    if (!r) continue;
    try { out.push(JSON.parse(await decrypt(r.data.enc))); } catch { /* chat dañado: se omite */ }
  }
  return out.sort((a, b) => b.updated - a.updated).slice(0, MAX_CHATS);
}

export async function saveChats(u, list) {
  requireSync(u);
  if (!Array.isArray(list) || list.length > BATCH) fail(400, "bad_batch", `Máximo ${BATCH} chats por envío.`);
  let saved = 0;
  for (const raw of list) {
    const c = clean(raw || {});
    const json = JSON.stringify(c);
    if (json.length > MAX_BYTES) continue; // un chat enorme se queda solo en el dispositivo
    const cur = await getJSON("chats", key(u.id, c.id));
    if (cur && cur.data.updated > c.updated) continue; // ya hay una versión más nueva en la cuenta
    await putJSON("chats", key(u.id, c.id), { updated: c.updated, enc: await encrypt(json) });
    saved++;
  }
  // Límite por cuenta: se borran los más viejos.
  const keys = await listKeys("chats", `c/${u.id}/`);
  if (keys.length > MAX_CHATS) {
    const meta = [];
    for (const k of keys) meta.push({ k, t: (await getJSON("chats", k))?.data.updated || 0 });
    meta.sort((a, b) => a.t - b.t);
    for (const m of meta.slice(0, keys.length - MAX_CHATS)) await del("chats", m.k);
  }
  return { saved };
}

export async function deleteChats(u, ids) {
  if (!u) fail(401, "no_session", "Inicie sesión.");
  if (!Array.isArray(ids) || ids.length > 100) fail(400, "bad_batch", "Lista inválida.");
  for (const id of ids) await del("chats", key(u.id, cleanId(id)));
}

/** Borra todos los chats guardados de la cuenta (al desactivar la opción o al eliminar la cuenta). */
export async function wipeChats(uid) {
  for (const k of await listKeys("chats", `c/${uid}/`)) await del("chats", k);
}
