// Registro de auditoría del panel (quién hizo qué y cuándo). Nunca guarda el contenido de los chats.
import { getJSON, putJSON, listKeys } from "./db.mjs";
import { now, randomToken } from "./util.mjs";

export async function audit(by, action, target, detail = {}) {
  await putJSON("audit", `${new Date().toISOString()}-${randomToken(5)}`, { at: now(), by, action, target, detail });
}

export async function recent(store, limit = 200) {
  const keys = (await listKeys(store)).sort().slice(-limit).reverse();
  const out = [];
  for (const k of keys) { const r = await getJSON(store, k); if (r) out.push(r.data); }
  return out;
}
