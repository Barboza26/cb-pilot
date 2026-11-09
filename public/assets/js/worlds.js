/* CB Pilot — Mundos.
   Cada mundo es un fondo de color con luces suaves inspiradas en su paisaje (solo CSS, sin imágenes).
   Cambiar de mundo no recarga la página ni toca la conversación. */
(() => {
  const d = document.documentElement;
  const host = document.querySelector(".pl-main");
  if (!host) return;
  // Mundos con fondo propio (el resto usa el fondo de CB Pilot Original)
  const FILES = { selva: "selva", arenal: "arenal", caribe: "caribe", pacifico: "atardecer", bandera: "bandera" };
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
    // Sin fotos: cada mundo es un fondo de color con luces suaves (todo en CSS, no descarga nada).
    el.innerHTML = `<i class="ly"></i><i class="glow g1"></i><i class="glow g2"></i><i class="glow g3"></i>`;
    host.prepend(el);
    scene = el;
    requestAnimationFrame(() => requestAnimationFrame(() => el.isConnected && el.classList.add("is-in")));
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
