/* CB Pilot — Mundos inmersivos (Fase 4: Selva).
   Cada mundo es un paisaje por capas detrás del chat. Las imágenes se descargan solo cuando ese mundo está activo,
   y cambiar de mundo no recarga la página ni toca la conversación. */
(() => {
  const d = document.documentElement;
  const host = document.querySelector(".pl-main");
  if (!host) return;
  // [capa, profundidad para el parallax]: más profundidad = se mueve más (está más cerca).
  const SCENES = {
    selva: ["cielo", .15, "volcan", .25, "bosque", .45, "cascada", .55, "niebla", .35, "rayos", .2, "rama", .8, "luciernagas", .6, "hojas", .7, "marco", 1]
  };
  let scene = null, current = "";
  const reduce = () => "ahorro" in d.dataset || matchMedia("(prefers-reduced-motion: reduce)").matches;
  // Día o noche según la hora de Costa Rica (no la del dispositivo).
  const crHour = () => +new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: "America/Costa_Rica" }).format(new Date());
  const timeOfDay = () => { const h = crHour(); return h >= 18 || h < 5 ? "noche" : "dia"; };

  function mount() {
    const w = d.dataset.accent || "original";
    if (w === current) return;
    current = w;
    if (scene) { const old = scene; old.classList.remove("is-in"); setTimeout(() => old.remove(), 800); scene = null; }
    const layers = SCENES[w];
    host.classList.toggle("has-world", !!layers);
    if (!layers) return;
    const el = document.createElement("div");
    el.className = `pl-scene scene-${w}`;
    el.setAttribute("aria-hidden", "true");
    el.dataset.time = timeOfDay();
    // En pantallas chicas se usan versiones livianas (m-*.webp) y se omiten la cascada y la rama.
    const small = matchMedia("(max-width: 820px)").matches, SKIP_SMALL = ["cascada", "rama"];
    let html = "";
    for (let i = 0; i < layers.length; i += 2) {
      const k = layers[i];
      if (small && SKIP_SMALL.includes(k)) continue;
      html += `<i class="ly ly-${k}" style="--z:${layers[i + 1]};--img:url(/worlds/${w}/${small ? "m-" : ""}${k}.webp)"></i>`;
    }
    el.innerHTML = html;
    host.prepend(el);
    scene = el;
    // Aparece con un fundido cuando ya cargó la capa principal (o enseguida si falla).
    const img = new Image();
    img.onload = img.onerror = () => requestAnimationFrame(() => el.isConnected && el.classList.add("is-in"));
    img.src = `/worlds/${w}/${small ? "m-" : ""}bosque.webp`;
  }
  new MutationObserver(mount).observe(d, { attributes: true, attributeFilter: ["data-accent"] });
  mount();
  setInterval(() => { if (scene) scene.dataset.time = timeOfDay(); }, 5 * 60e3);
  // Prueba manual: ?hora=noche o ?hora=dia
  const forced = new URLSearchParams(location.search).get("hora");
  if (forced === "noche" || forced === "dia") { const set = () => scene && (scene.dataset.time = forced); set(); new MutationObserver(set).observe(host, { childList: true }); }

  // Parallax suave con el mouse (no en pantallas táctiles, ni en modo Ahorro o con «reducir movimiento»).
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
