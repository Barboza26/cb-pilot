// Acceso a la base de datos (Netlify Blobs) con escrituras condicionales.
// En pruebas se reemplaza por una implementación en memoria con setStoreFactory().
import { getStore } from "@netlify/blobs";

let factory = null;
const cache = new Map();
export function setStoreFactory(f) { factory = f; cache.clear(); }

// Aislamiento: las vistas previas (deploy-preview-N--sitio / rama--sitio) usan almacenes separados
// con prefijo "preview-", para que las pruebas nunca toquen los datos de producción.
let namespace = "";
/** Se llama al inicio de CADA invocación: las credenciales de Blobs son por invocación y vencen,
 *  así que nunca se reutiliza un almacén creado en una solicitud anterior. */
export function resetStores() { cache.clear(); }
export function setNamespaceFromHost(host) {
  cache.clear();
  const h = String(host || "").toLowerCase();
  namespace = /^deploy-preview-\d+--|^[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(h) || (process.env.CONTEXT && process.env.CONTEXT !== "production") ? "preview-" : "";
  return namespace;
}
export const currentNamespace = () => namespace;

function store(name) {
  const full = namespace + name;
  if (!cache.has(full)) cache.set(full, factory ? factory(full) : getStore({ name: full, consistency: "strong" }));
  return cache.get(full);
}

/** Lee un JSON. Devuelve { data, etag } o null. */
export async function getJSON(name, key) {
  const r = await store(name).getWithMetadata(key, { type: "json" });
  return r ? { data: r.data, etag: r.etag } : null;
}

/** Escribe un JSON. opts: { ifMatch: etag } | { ifNew: true }. Devuelve true si se escribió. */
export async function putJSON(name, key, data, opts = {}) {
  const o = {};
  if (opts.ifMatch) o.onlyIfMatch = opts.ifMatch;
  else if (opts.ifNew) o.onlyIfNew = true;
  const r = await store(name).setJSON(key, data, o);
  return r ? r.modified !== false : true;
}

export async function putBinary(name, key, data, metadata = {}) {
  await store(name).set(key, data, { metadata });
}
export async function getBinary(name, key) {
  const r = await store(name).getWithMetadata(key, { type: "arrayBuffer" });
  return r ? { data: r.data, metadata: r.metadata || {} } : null;
}
export async function listKeys(name, prefix = "") {
  const r = await store(name).list({ prefix });
  return r.blobs.map(b => b.key);
}
export async function del(name, key) { await store(name).delete(key); }

/**
 * Actualización atómica optimista: lee, aplica fn(actual) y escribe solo si nadie
 * cambió el registro entretanto. Reintenta ante conflictos.
 * fn recibe el valor actual (o undefined) y devuelve el nuevo valor, o lanza un error.
 */
export async function update(name, key, fn, { retries = 8, init } = {}) {
  for (let i = 0; i < retries; i++) {
    const cur = await getJSON(name, key);
    const base = cur ? cur.data : (typeof init === "function" ? init() : init);
    const next = await fn(structuredClone(base));
    const ok = cur ? await putJSON(name, key, next, { ifMatch: cur.etag }) : await putJSON(name, key, next, { ifNew: true });
    if (ok) return next;
    await new Promise(r => setTimeout(r, 15 + Math.random() * 40 * (i + 1)));
  }
  throw Object.assign(new Error("Conflicto de escritura, intentá de nuevo."), { status: 409 });
}

/** Almacén en memoria con la misma semántica (solo para pruebas locales). */
export function memoryFactory() {
  const stores = new Map();
  let n = 0;
  return name => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      async getWithMetadata(key, { type } = {}) {
        if (!m.has(key)) return null;
        const e = m.get(key);
        let data = e.data;
        if (type === "json") data = JSON.parse(e.data);
        return { data, etag: e.etag, metadata: e.metadata };
      },
      async setJSON(key, data, o = {}) { return this.set(key, JSON.stringify(data), o); },
      async set(key, data, o = {}) {
        const cur = m.get(key);
        if (o.onlyIfNew && cur) return { modified: false };
        if (o.onlyIfMatch && (!cur || cur.etag !== o.onlyIfMatch)) return { modified: false };
        const etag = "e" + (++n);
        m.set(key, { data, etag, metadata: o.metadata || {} });
        return { modified: true, etag };
      },
      async list({ prefix = "" } = {}) { return { blobs: [...m.keys()].filter(k => k.startsWith(prefix)).map(key => ({ key, etag: m.get(key).etag })), directories: [] }; },
      async delete(key) { m.delete(key); }
    };
  };
}
