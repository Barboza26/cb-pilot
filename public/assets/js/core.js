/* CeBe Pilot — base de todas las páginas: idioma ES/EN, utilidades y llamadas a la API. */
(() => {
  "use strict";
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // Textos en inglés de los elementos con data-i18n (el español está en el HTML).
  const EN = {
    "skip": "Skip to content", "pl.new": "New chat", "pl.chats": "Chats", "pl.tasks": "Tasks", "pl.search": "Search chats", "pl.plans": "Plans",
    "pl.openPanel": "Open history", "pl.closePanel": "Close panel", "pl.ask": "Your message for CeBe Pilot", "pl.placeholder": "Tell Pilo what you need…", "pl.send": "Send",
    "pl.note": "CeBe Pilot can make mistakes: double-check important info. Don't share passwords or sensitive data.",
    "pl.tasks.eyebrow": "Control tower", "pl.tasks.title": "Several missions, <span class='grad'>at the same time</span>.",
    "pl.tasks.lead": "Write one task per line (or pick a route) and Pilo launches them in parallel. Each card can be copied or opened as a chat to keep going.",
    "pl.tasks.input": "Tasks, one per line", "pl.tasks.ph": "E.g.: Write 5 post ideas for my bakery\nWrite the “About us” section of my website\nBuild a 2-week content plan",
    "pl.tasks.go": "✈️ Take off", "pl.tasks.board": "Board", "pl.tasks.clear": "Clear finished",
    "pl.canvas": "Preview", "pl.desktop": "Desktop", "pl.mobile": "Mobile", "pl.download": "Download HTML", "pl.closePreview": "Close preview",
    "pl.privacy": "Privacy", "pl.terms": "Terms", "pg.back": "Back to CeBe Pilot",
    "pl.attach": "Attach a file or photo", "pl.mic": "Voice dictation", "pl.drop": "Drop your files or photos here", "pl.look": "Appearance"
  };

  let lang = "es";
  $$("[data-i18n]").forEach(el => { el.dataset.es = el.innerHTML; });
  $$("[data-i18n-attr]").forEach(el => { const [a] = el.dataset.i18nAttr.split(":"); el.dataset.esAttr = el.getAttribute(a) || ""; });
  const listeners = [];
  function setLang(l, persist = true) {
    lang = l === "en" ? "en" : "es";
    document.documentElement.lang = lang;
    $$("[data-i18n]").forEach(el => { const v = EN[el.dataset.i18n]; el.innerHTML = lang === "en" && v !== undefined ? v : el.dataset.es; });
    $$("[data-i18n-attr]").forEach(el => { const [a, k] = el.dataset.i18nAttr.split(":"); const v = EN[k]; el.setAttribute(a, lang === "en" && v !== undefined ? v : el.dataset.esAttr); });
    $$("[data-lang]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.lang === lang)));
    // Páginas con un bloque por idioma (privacidad, términos)
    $$("[data-only]").forEach(el => { el.hidden = el.dataset.only !== lang; });
    if (persist) try { localStorage.setItem("cbpilot-lang", lang); } catch {}
    listeners.forEach(f => f(lang));
  }
  $$("[data-lang]").forEach(b => b.addEventListener("click", () => setLang(b.dataset.lang)));
  const t = (k, es) => (lang === "en" && EN[k] !== undefined ? EN[k] : es);

  async function api(path, body, opts = {}) {
    const init = body !== undefined ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {};
    let res;
    try { res = await fetch(path, { credentials: "same-origin", ...init, ...opts }); }
    catch { throw Object.assign(new Error(lang === "en" ? "No connection to the server." : "Sin conexión con el servidor."), { code: "offline" }); }
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) throw Object.assign(new Error(lang === "en" ? "CeBe Pilot needs its online server." : "CeBe Pilot necesita su servidor en línea."), { code: "offline", status: res.status });
    const data = await res.json();
    if (!res.ok || data.ok === false) throw Object.assign(new Error(data.message || "Error"), { code: data.error, status: res.status });
    return data;
  }

  window.PILOT_APP = { $, $$, esc, t, api, onLang: f => listeners.push(f), get lang() { return lang; } };

  // Idioma inicial: el elegido antes; si no, el del navegador.
  let saved = null; try { saved = localStorage.getItem("cbpilot-lang"); } catch {}
  const initial = saved || ((navigator.language || "es").toLowerCase().startsWith("en") ? "en" : "es");
  queueMicrotask(() => setLang(initial, false));
})();
