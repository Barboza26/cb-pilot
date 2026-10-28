/* CB Pilot — aplica el tema (oscuro/claro/sistema) y el color de acento ANTES de pintar la página.
   Se carga sin "defer" a propósito: así no hay un destello del tema equivocado. */
(() => {
  const d = document.documentElement;
  const get = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };
  const dark = matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    const t = get("cbpilot-theme", "dark");
    d.dataset.theme = t === "system" ? (dark.matches ? "dark" : "light") : t;
    d.dataset.accent = get("cbpilot-accent", "azul");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = d.dataset.theme === "light" ? "#F4F7FC" : "#070D1C";
  }
  apply();
  dark.addEventListener?.("change", apply);
  window.CBPILOT_THEME = {
    get theme() { return get("cbpilot-theme", "dark"); }, get accent() { return get("cbpilot-accent", "azul"); },
    set(k, v) { try { localStorage.setItem(k === "theme" ? "cbpilot-theme" : "cbpilot-accent", v); } catch {} apply(); }
  };
  document.addEventListener("DOMContentLoaded", apply);
})();
