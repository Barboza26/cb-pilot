/* CB Pilot — aplica el tema (oscuro/claro/sistema) y el color de acento ANTES de pintar la página.
   Se carga sin "defer" a propósito: así no hay un destello del tema equivocado. */
(() => {
  const d = document.documentElement;
  const get = (k, def) => { try { return localStorage.getItem(k) || def; } catch { return def; } };
  const dark = matchMedia("(prefers-color-scheme: dark)");
  function apply() {
    const t = get("cbpilot-theme", "dark");
    d.dataset.theme = t === "system" ? (dark.matches ? "dark" : "light") : t;
    const a = get("cbpilot-accent", "original");
    d.dataset.accent = ["original", "selva", "arenal", "caribe", "pacifico", "bandera"].includes(a) ? a : "original"; // mundos
    // Modo Ahorro: lo elige el usuario; si nunca eligió, se activa solo cuando el sistema pide menos movimiento
    const ah = get("cbpilot-ahorro", "");
    if (ah === "1" || (ah === "" && matchMedia("(prefers-reduced-motion: reduce)").matches)) d.dataset.ahorro = ""; else delete d.dataset.ahorro;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = d.dataset.theme === "light" ? "#F4F7FC" : "#070D1C";
  }
  apply();
  dark.addEventListener?.("change", apply);
  window.CBPILOT_THEME = {
    get theme() { return get("cbpilot-theme", "dark"); }, get accent() { return d.dataset.accent || "original"; }, get ahorro() { return "ahorro" in d.dataset; },
    set(k, v) { try { localStorage.setItem({ theme: "cbpilot-theme", accent: "cbpilot-accent", ahorro: "cbpilot-ahorro" }[k], v); } catch {} apply(); }
  };
  document.addEventListener("DOMContentLoaded", apply);
})();
