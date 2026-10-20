/* CB Pilot — panel de administración (solo el dueño). Todo se valida y autoriza en el servidor. */
(() => {
  "use strict";
  const A = window.PILOT_APP; if (!A) return;
  const { $, esc, api } = A;
  const root = $("#admin");
  const date = s => { try { return new Date(s).toLocaleString("es-CR", { dateStyle: "short", timeStyle: "short" }); } catch { return s; } };
  let tab = "resumen";
  const msg = (text, ok) => `<p class="form-msg${ok ? " ok" : ""}" role="status">${esc(text)}</p>`;

  async function start() {
    try { await api("/api/admin/me"); return shell(); } catch (e) { if (e.code === "offline") { root.innerHTML = msg(e.message); return; } }
    const st = await api("/api/admin/status").catch(e => ({ error: e }));
    if (st.error) { root.innerHTML = msg(st.error.message); return; }
    if (!st.exists) {
      root.innerHTML = st.setupAvailable ? `<form class="card checkout" id="setup"><h1>Configurar administración</h1>
        <p class="muted">Primer acceso. Usá el código ADMIN_SETUP_CODE que definiste en Netlify.</p>
        <div class="field"><label for="s-code">Código de configuración</label><input id="s-code" required autocomplete="off"></div>
        <div class="field"><label for="s-email">Tu correo</label><input id="s-email" type="email" required autocomplete="username"></div>
        <div class="field"><label for="s-pw">Contraseña (mínimo 12 caracteres)</label><input id="s-pw" type="password" minlength="12" required autocomplete="new-password"></div>
        <div id="s-msg"></div><button class="btn btn-primary">Crear administrador</button></form>`
        : `<div class="card checkout"><h1>Administración</h1><p>Para activar el panel, en Netlify → Project configuration → Environment variables agregá <code>ADMIN_SETUP_CODE</code> con un código secreto de al menos 12 caracteres (elegilo vos) y volvé a publicar. Luego regresá aquí.</p></div>`;
      $("#setup")?.addEventListener("submit", async e => {
        e.preventDefault();
        try { await api("/api/admin/setup", { code: $("#s-code").value, email: $("#s-email").value, password: $("#s-pw").value }); loginView("Administrador creado. Iniciá sesión."); }
        catch (err) { $("#s-msg").innerHTML = msg(err.message); }
      });
      return;
    }
    loginView();
  }
  function loginView(note) {
    root.innerHTML = `<form class="card checkout" id="login"><h1>Administración</h1>${note ? msg(note, true) : ""}
      <div class="field"><label for="l-email">Correo</label><input id="l-email" type="email" required autocomplete="username"></div>
      <div class="field"><label for="l-pw">Contraseña</label><input id="l-pw" type="password" required autocomplete="current-password"></div>
      <div id="l-msg"></div><button class="btn btn-primary">Entrar</button></form>`;
    $("#login").addEventListener("submit", async e => {
      e.preventDefault();
      try { await api("/api/admin/login", { email: $("#l-email").value, password: $("#l-pw").value }); shell(); }
      catch (err) { $("#l-msg").innerHTML = msg(err.message); }
    });
  }

  const TABS = [["resumen", "Uso, planes y códigos"], ["auditoria", "Auditoría"], ["cuenta", "Cuenta"]];
  function shell() {
    root.innerHTML = `<div class="adm"><h1>Administración</h1>
      <nav class="adm-nav" aria-label="Secciones">${TABS.map(([k, v]) => `<button type="button" data-tab="${k}" aria-pressed="${k === tab}">${v}</button>`).join("")}</nav>
      <div id="view"></div></div>`;
    show(tab);
  }
  async function show(k) {
    tab = k; root.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.tab === k)));
    const v = $("#view"); v.innerHTML = "<p>Cargando…</p>";
    try { await VIEWS[k](v); } catch (e) { if (e.status === 401) return loginView("Tu sesión terminó. Volvé a entrar."); v.innerHTML = msg(e.message); }
  }

  const VIEWS = {
    // CB Pilot: presupuesto de la IA, precios de los planes y códigos de acceso. No se guardan conversaciones.
    async resumen(v) {
      const d = await api("/api/admin/pilot"), c = d.config, sp = d.spend, P = d.plans;
      const usd = n => "US$" + Number(n || 0).toFixed(Number(n || 0) < 1 ? 3 : 2);
      const pct = Math.min(100, Math.round((sp.usd / c.budgetUsd) * 100));
      const days = Object.entries(sp.days || {}).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10);
      v.innerHTML = `${d.keyConfigured ? "" : `<p class="form-msg">Falta la clave de la IA: en Netlify → Project configuration → Environment variables agregá <code>ANTHROPIC_API_KEY</code> (se crea en console.anthropic.com) y volvé a publicar. Mientras tanto CB Pilot muestra «todavía no está activado».</p>`}
        <div class="kpis"><div class="card kpi"><span class="muted">Gasto de ${esc(d.month)}</span><b>${usd(sp.usd)}</b><small class="muted">${pct} % de ${usd(c.budgetUsd)}</small></div>
          <div class="card kpi"><span class="muted">Mensajes del mes</span><b>${sp.msgs || 0}</b></div>
          ${Object.keys(P).map(k => `<div class="card kpi"><span class="muted">Plan ${esc(P[k].name)}</span><b>${sp.plans?.[k]?.msgs || 0}</b><small class="muted">${usd(sp.plans?.[k]?.usd)}</small></div>`).join("")}</div>
        <form class="card checkout" id="pcfg"><h2>Configuración</h2>
          <label class="check"><input type="checkbox" id="q-en" ${c.enabled ? "checked" : ""}> CB Pilot activo (desmarcalo para pausarlo de inmediato).</label>
          <div class="fields"><div class="field"><label for="q-b">Presupuesto mensual de la IA (US$)</label><input id="q-b" type="number" min="1" step="1" value="${c.budgetUsd}"></div>
          <div class="field"><label for="q-fs">El plan gratis se pausa al llegar al (% del presupuesto)</label><input id="q-fs" type="number" min="0" max="100" value="${Math.round(c.freeShare * 100)}"></div>
          <div class="field"><label for="q-fd">Mensajes gratis por día (por persona)</label><input id="q-fd" type="number" min="0" max="500" value="${c.freePerDay}"></div><div class="field"></div>
          <div class="field"><label for="q-pp">Precio plan Pro (₡ por mes; vacío = «por WhatsApp»)</label><input id="q-pp" type="number" min="0" value="${c.prices.pro ?? ""}"></div>
          <div class="field"><label for="q-pm">Precio plan Max (₡ por mes; vacío = «por WhatsApp»)</label><input id="q-pm" type="number" min="0" value="${c.prices.max ?? ""}"></div></div>
          <p class="muted">Modelos: Gratis = ${esc(P.gratis.model)} · Pro = ${esc(P.pro.model)} (${P.pro.perDay}/día, ${P.pro.perMonth}/mes) · Max = ${esc(P.max.model)} (${P.max.perDay}/día, ${P.max.perMonth}/mes). Corte por tiempo: ${d.deadlineMs} ms.</p>
          <div id="q-msg"></div><button class="btn btn-primary">Guardar</button></form>
        <form class="card checkout" id="pcode"><h2>Crear código de acceso</h2><p class="muted">Cuando un cliente paga su plan (por ejemplo por SINPE), creale un código y enviáselo por WhatsApp. Lo activa en CB Pilot → Planes. El código se muestra una sola vez.</p>
          <div class="fields"><div class="field"><label for="n-pl">Plan</label><select id="n-pl"><option value="pro">Pro</option><option value="max">Max</option></select></div>
          <div class="field"><label for="n-d">Días de vigencia</label><input id="n-d" type="number" min="1" max="400" value="30"></div>
          <div class="field full"><label for="n-l">Cliente o nota (para identificarlo)</label><input id="n-l" maxlength="120" placeholder="Ej.: Ana Mora · SINPE 12/10"></div></div>
          <div id="n-msg"></div><button class="btn btn-primary">Crear código</button></form>
        <h2>Códigos</h2><div class="tbl"><table><tr><th>Cliente</th><th>Plan</th><th>Termina en</th><th>Vence</th><th>Activaciones</th><th></th></tr>
          ${d.codes.map(x => `<tr><td>${esc(x.label || "—")}</td><td>${esc(P[x.plan]?.name || x.plan)}</td><td>…${esc(x.last4)}</td><td>${date(x.expiresAt)}</td><td>${x.activations || 0}</td><td>${x.active ? `<button class="btn btn-ghost btn-sm" data-revoke="${esc(x.id)}">Desactivar</button>` : "Desactivado"}</td></tr>`).join("") || "<tr><td colspan=6>Todavía no hay códigos.</td></tr>"}</table></div>
        ${days.length ? `<h2>Últimos días</h2><div class="tbl"><table><tr><th>Día</th><th>Mensajes</th><th>Gasto</th></tr>${days.map(([k, x]) => `<tr><td>${esc(k)}</td><td>${x.msgs}</td><td>${usd(x.usd)}</td></tr>`).join("")}</table></div>` : ""}
        <p class="muted">Privacidad: el servidor no guarda el contenido de los chats; solo cuenta mensajes y gasto. Las conversaciones quedan en el dispositivo de cada persona.</p>`;
      $("#pcfg").addEventListener("submit", async e => {
        e.preventDefault();
        const config = { enabled: $("#q-en").checked, budgetUsd: Number($("#q-b").value), freeShare: Number($("#q-fs").value) / 100, freePerDay: Number($("#q-fd").value), prices: { pro: $("#q-pp").value, max: $("#q-pm").value } };
        try { await api("/api/admin/pilot/config", { config }); $("#q-msg").innerHTML = msg("Guardado.", true); } catch (err) { $("#q-msg").innerHTML = msg(err.message); }
      });
      $("#pcode").addEventListener("submit", async e => {
        e.preventDefault();
        try {
          const r = await api("/api/admin/pilot/code", { plan: $("#n-pl").value, days: Number($("#n-d").value), label: $("#n-l").value });
          const text = `¡Hola! Tu código de CB Pilot ${P[r.record.plan].name} es ${r.code} (vence el ${date(r.record.expiresAt)}). Activalo en ${location.origin}/ → Planes.`;
          await VIEWS.resumen(v); // actualiza la tabla de códigos; el código en claro se muestra solo aquí
          $("#n-msg").innerHTML = `<p class="form-msg ok" role="status">Código creado: <b style="font-family:var(--f-mono)">${esc(r.code)}</b> — copialo ahora, no se vuelve a mostrar.</p><p><button type="button" class="btn btn-ghost btn-sm" id="n-copy">Copiar mensaje para el cliente</button></p>`;
          $("#n-copy").addEventListener("click", () => navigator.clipboard?.writeText(text).then(() => { $("#n-copy").textContent = "¡Copiado!"; }));
        } catch (err) { $("#n-msg").innerHTML = msg(err.message); }
      });
      v.querySelectorAll("[data-revoke]").forEach(b => b.addEventListener("click", async () => {
        if (!confirm("¿Desactivar este código? El cliente pierde el acceso al plan.")) return;
        try { await api("/api/admin/pilot/revoke", { id: b.dataset.revoke }); VIEWS.resumen(v); } catch (err) { alert(err.message); }
      }));
    },
    async auditoria(v) {
      const d = await api("/api/admin/audit");
      v.innerHTML = `<div class="tbl"><table><tr><th>Fecha</th><th>Quién</th><th>Acción</th><th>Objeto</th></tr>${d.items.map(a => `<tr><td>${date(a.at)}</td><td>${esc(a.by)}</td><td>${esc(a.action)}</td><td>${esc(a.target)}</td></tr>`).join("")}</table></div>`;
    },
    async cuenta(v) {
      v.innerHTML = `<form class="card checkout" id="pw"><h2>Cambiar contraseña</h2><div class="field"><label for="p-c">Actual</label><input id="p-c" type="password" autocomplete="current-password" required></div><div class="field"><label for="p-n">Nueva (mínimo 12)</label><input id="p-n" type="password" minlength="12" autocomplete="new-password" required></div><div id="p-msg"></div><button class="btn btn-primary">Cambiar</button></form>
        <p><button class="btn btn-ghost" type="button" id="logout">Cerrar sesión</button></p>`;
      $("#pw").addEventListener("submit", async e => { e.preventDefault(); try { await api("/api/admin/password", { current: $("#p-c").value, next: $("#p-n").value }); loginView("Contraseña cambiada. Entrá de nuevo."); } catch (err) { $("#p-msg").innerHTML = msg(err.message); } });
      $("#logout").addEventListener("click", async () => { await api("/api/admin/logout", {}); loginView("Sesión cerrada."); });
    }
  };

  document.addEventListener("click", e => { const tb = e.target.closest("[data-tab]"); if (tb) show(tb.dataset.tab); });
  start();
})();
