/* CB Pilot — Mundos inmersivos.
   Cada mundo es un fondo propio, con una composición para computadora (16:9) y otra para celular (9:16).
   La imagen se descarga solo cuando ese mundo está activo, y cambiar de mundo no recarga la página
   ni toca la conversación. */
(() => {
  const d = document.documentElement;
  const host = document.querySelector(".pl-main");
  if (!host) return;
  // Mundo de la app → nombre de los archivos en /worlds/
  const FILES = { selva: "selva", arenal: "arenal", caribe: "caribe", pacifico: "atardecer", bandera: "bandera" };
  // Dirección completa de la carpeta de fondos, calculada desde este archivo (assets/js/worlds.js):
  // funciona igual en el sitio publicado, en la computadora y en la demo, sin depender de dónde se use la imagen.
  const BASE = new URL("../../worlds/", document.currentScript?.src || location.href).href;
  let scene = null, current = "";
  const reduce = () => "ahorro" in d.dataset || matchMedia("(prefers-reduced-motion: reduce)").matches;

  function mount() {
    const w = d.dataset.accent || "original";
    const erupcion = w === "arenal" && "erupcion" in d.dataset;
    const key = w + (erupcion ? ":erupcion" : "");
    if (key === current) return;
    current = key;
    if (scene) { const old = scene; old.classList.remove("is-in"); setTimeout(() => old.remove(), 900); scene = null; }
    const f = erupcion ? "erupcion" : FILES[w];
    host.classList.toggle("has-world", !!f);
    if (!f) return;
    const el = document.createElement("div");
    el.className = `pl-scene scene-${w}`;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML = `<i class="ly" style="--d:url('${BASE}${f}-desktop.webp');--m:url('${BASE}${f}-mobile.webp')"></i>`;
    host.prepend(el);
    scene = el;
    // Fundido de entrada cuando la imagen que corresponde a esta pantalla ya cargó.
    const img = new Image();
    img.onload = img.onerror = () => requestAnimationFrame(() => el.isConnected && el.classList.add("is-in"));
    img.src = `${BASE}${f}-${matchMedia("(orientation: portrait)").matches ? "mobile" : "desktop"}.webp`;
  }
  new MutationObserver(mount).observe(d, { attributes: true, attributeFilter: ["data-accent", "data-erupcion"] });
  mount();

  // Parallax muy suave con el mouse (no en pantallas táctiles, ni en modo Ahorro o con «reducir movimiento»).
  if (matchMedia("(pointer: fine)").matches) {
    let raf = 0, x = 0, y = 0;
    host.addEventListener("pointermove", e => {
      if (!scene || reduce()) return;
      const r = host.getBoundingClientRect();
      x = (e.clientX - r.left) / r.width - .5; y = (e.clientY - r.top) / r.height - .5;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; scene?.style.setProperty("--px", x.toFixed(3)); scene?.style.setProperty("--py", y.toFixed(3)); });
    }, { passive: true });
  }
})();
