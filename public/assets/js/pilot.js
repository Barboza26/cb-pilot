/* CB Pilot — interfaz del asistente de inteligencia artificial.
   Chats que responden en paralelo, Modo Tareas, vista previa de diseños HTML y planes con código de acceso.
   Las conversaciones se guardan SOLO en este dispositivo (localStorage); la IA responde desde /api/pilot/chat. */
(() => {
  "use strict";
  const A = window.PILOT_APP; if (!A) return;
  const { $, $$, esc } = A;
  const root = $("#pilot"); if (!root) return;
  const T = (es, en) => (A.lang === "en" ? en : es);
  const K = { chats: "cbpilot-chats", tasks: "cbpilot-tasks", pass: "cbpilot-pass", current: "cbpilot-current" };
  const ICO = {
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    regen: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
    up: '<path d="M7 10v11H4V10zM7 10l4-8a3 3 0 0 1 3 3v4h5.5a2 2 0 0 1 2 2.3l-1.4 8A2 2 0 0 1 18 21H7"/>',
    down: '<path d="M17 14V3h3v11zM17 14l-4 8a3 3 0 0 1-3-3v-4H4.5a2 2 0 0 1-2-2.3l1.4-8A2 2 0 0 1 6 3h11"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    pin: '<path d="M12 17v5M9 3h6l-1 6 4 4H6l4-4z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15"/>',
    play: '<path d="M8 5v14l11-7z"/>',
    chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    send: '<path d="M12 19V5M5 12l7-7 7 7"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
    more: '<path d="M6 9l6 6 6-6"/>'
  };
  const icon = (k, s = 15) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
  // Pilo, la lapa copiloto (mismo dibujo que /assets/img/pilo.svg, en línea para poder animarlo)
  const PILO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" class="pilo __CLS__" aria-hidden="true" focusable="false"> <defs> <radialGradient id="pl-red" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#FF5A4E"/><stop offset=".6" stop-color="#E0262B"/><stop offset="1" stop-color="#A3141C"/></radialGradient> <linearGradient id="pl-wing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E0262B"/><stop offset=".38" stop-color="#FACC15"/><stop offset=".62" stop-color="#22C55E"/><stop offset="1" stop-color="#2563EB"/></linearGradient> <linearGradient id="pl-glass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7DD3FC"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient> <linearGradient id="pl-beak" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFBF2"/><stop offset="1" stop-color="#E8DCC6"/></linearGradient> </defs> <g class="pilo-wing"><path d="M30 64c-9 10-12 26-6 42 4 2 9-1 12-5 6-10 10-22 10-34-5-4-11-5-16-3z" fill="url(#pl-wing)" stroke="#7F1D1D" stroke-width="1.5" stroke-linejoin="round"/> <path d="M27 82c4 0 8-2 11-5M26 93c4 0 8-2 10-5" stroke="#0F2A6B" stroke-opacity=".35" stroke-width="2" fill="none" stroke-linecap="round"/></g> <path d="M60 18c-20 0-34 15-34 35 0 13 5 24 14 32 2 12 9 22 20 25 12-3 19-14 20-26 9-8 14-18 14-31 0-20-14-35-34-35z" fill="url(#pl-red)" stroke="#7F1D1D" stroke-width="2" stroke-linejoin="round"/> <path d="M46 22c-4-8-1-14 4-16 0 6 2 10 6 12M56 18c0-8 5-12 10-12-2 5-1 9 2 12" fill="#E0262B" stroke="#7F1D1D" stroke-width="2" stroke-linejoin="round"/> <path d="M64 44c10-3 21 2 23 12 2 9-4 16-13 17-9 0-15-6-15-14 0-6 2-12 5-15z" fill="#FFF7EC"/> <path d="M68 66c3 1 6 1 9 0M70 70c3 .6 5 .6 7 0" stroke="#E7B8A6" stroke-width="1.4" fill="none" stroke-linecap="round"/> <g class="pilo-eye"><circle cx="74" cy="55" r="6.2" fill="#FDE68A"/><circle cx="74.6" cy="55.2" r="4.4" fill="#111827"/><circle cx="76.2" cy="53.4" r="1.6" fill="#fff"/> <rect class="pilo-lid" x="67" y="48" width="14" height="14" rx="7" fill="#FFF7EC" transform="scale(1 0)" transform-origin="74 55"/></g> <path d="M83 56c10 0 17 7 17 17 0 6-3 11-6 13 0-6-3-10-8-11-3-1-6-1-8-3z" fill="url(#pl-beak)" stroke="#6B5B45" stroke-width="1.6" stroke-linejoin="round"/> <path d="M80 73c4 1 8 3 9 8-4 3-9 3-12 0 0-3 1-6 3-8z" fill="#1F2937" stroke="#0B0F17" stroke-width="1.2" stroke-linejoin="round"/> <path d="M30 34c10-9 28-12 44-8 6 1 11 4 15 7" stroke="#7C4A1E" stroke-width="5" fill="none" stroke-linecap="round"/> <g stroke="#F2B705" stroke-width="2.6"><circle cx="50" cy="28" r="9" fill="url(#pl-glass)"/><circle cx="70" cy="27" r="9" fill="url(#pl-glass)"/><path d="M59 28h2" stroke-linecap="round"/></g> <path d="M45 24c2-2 4-3 7-3M65 23c2-2 4-3 7-3" stroke="#fff" stroke-opacity=".75" stroke-width="2" fill="none" stroke-linecap="round"/> <path d="M42 90c10 5 26 5 36 0l-1 6c-10 5-24 5-34 0z" fill="#fff"/> <path d="M42 90c10 5 26 5 36 0l-.4 2.2c-10 4.6-25 4.6-35.2 0zM43 95.2c10 4.6 24 4.6 34 0l-.3 1.6c-10 4.6-23.6 4.6-33.4 0z" fill="#002B7F"/> <path d="M42.6 92.8c10 4.6 25 4.6 35 0l-.5 2.6c-10 4.6-24 4.6-34 0z" fill="#CE1126"/> </svg>`;
  const pilo = (cls = "") => PILO.replace("__CLS__", cls);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  // ---------------- Almacenamiento local ----------------
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } };
  function write(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch {
      if (k !== K.chats) return false;
      // Sin espacio: se quitan los chats más viejos que no estén fijados.
      const old = [...chats].reverse().find(c => !c.pinned && !running.has(c.id));
      if (!old) return false;
      chats = chats.filter(c => c !== old);
      return write(k, chats);
    }
  }
  let chats = (Array.isArray(read(K.chats, [])) ? read(K.chats, []) : []).filter(c => c && c.id && Array.isArray(c.messages));
  let tasks = (Array.isArray(read(K.tasks, [])) ? read(K.tasks, []) : []).filter(t => t && t.id && t.prompt);
  let current = read(K.current, null), pass = read(K.pass, null);
  let info = null, view = "chat", query = "";
  const running = new Map(); // id de chat o tarea → AbortController
  const saveChats = () => { chats.sort((a, b) => (b.updated || 0) - (a.updated || 0)); chats = chats.slice(0, 80); write(K.chats, chats); write(K.current, current); };
  const saveTasks = () => write(K.tasks, tasks.slice(0, 60));
  // Lo que quedó a medias al cerrar la página se marca como interrumpido.
  for (const c of chats) for (const m of c.messages) if (m.pending) { delete m.pending; if (!m.content) { m.error = "cut"; m.errorMsg = "La respuesta se interrumpió."; } }
  for (const t of tasks) if (t.status === "running") { t.status = "error"; t.error = "La tarea se interrumpió al cerrar la página."; }

  // ---------------- Markdown seguro (todo se escapa antes de dar formato) ----------------
  const safeUrl = u => { const v = String(u).replace(/&amp;/g, "&"); return /^(https?:\/\/|mailto:|\/(?!\/)|#)/i.test(v) ? v : null; };
  function inline(s) {
    const keep = [], hold = h => `\u0001${keep.push(h) - 1}\u0001`;
    s = s.replace(/`([^`\n]+)`/g, (_, c) => hold(`<code>${c}</code>`));
    s = s.replace(/\[([^\]\n]+)\]\(([^)\s]+)\)/g, (m, t, u) => { const url = safeUrl(u); return url ? hold(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t}</a>`) : m; });
    s = s.replace(/\bhttps?:\/\/[^\s<\u0001]+[^\s<.,;:!?)\]'"*_\u0001]/g, u => { const url = safeUrl(u); return url ? hold(`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${u}</a>`) : u; });
    s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>").replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*\w])\*([^*\s][^*\n]*?)\*(?![*\w])/g, "$1<em>$2</em>")
      .replace(/(^|[\s(])_([^_\s][^_\n]*?)_(?=[\s).,!?:;]|$)/g, "$1<em>$2</em>")
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>");
    return s.replace(/\u0001(\d+)\u0001/g, (_, i) => keep[i]);
  }
  const LIST = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
  const TSEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;
  function list(items, from) {
    const base = items[from].indent, ord = items[from].ord;
    let html = ord ? `<ol${ord !== 1 ? ` start="${ord}"` : ""}>` : "<ul>", k = from;
    while (k < items.length && items[k].indent >= base) {
      if (items[k].indent > base) { const [sub, nk] = list(items, k); html = html.replace(/<\/li>$/, sub + "</li>"); k = nk; continue; }
      html += `<li>${inline(items[k].text)}</li>`; k++;
    }
    return [html + (ord ? "</ol>" : "</ul>"), k];
  }
  const cells = row => row.trim().replace(/^\||\|$/g, "").split("|").map(c => inline(c.trim()));
  function blocks(src) {
    const lines = esc(src).split("\n"); let out = "", i = 0;
    while (i < lines.length) {
      const l = lines[i]; let m;
      if (!l.trim()) { i++; continue; }
      if ((m = l.match(/^\s{0,3}(#{1,6})\s+(.*?)#*\s*$/))) { const h = Math.min(m[1].length + 1, 4); out += `<h${h}>${inline(m[2])}</h${h}>`; i++; continue; }
      if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(l)) { out += "<hr>"; i++; continue; }
      if (/^\s*&gt;/.test(l)) { const q = []; while (i < lines.length && /^\s*&gt;/.test(lines[i])) q.push(lines[i++].replace(/^\s*&gt;\s?/, "")); out += `<blockquote>${blocks(q.join("\n").replace(/&gt;/g, ">").replace(/&lt;/g, "<").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&"))}</blockquote>`; continue; }
      if (l.includes("|") && i + 1 < lines.length && TSEP.test(lines[i + 1])) {
        const head = cells(l); i += 2; const rows = [];
        while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(cells(lines[i++]));
        out += `<div class="tbl"><table><thead><tr>${head.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
        continue;
      }
      if (LIST.test(l)) {
        const items = [];
        while (i < lines.length) {
          const x = lines[i].match(LIST);
          if (x) { items.push({ indent: x[1].replace(/\t/g, "  ").length, ord: /\d/.test(x[2]) ? parseInt(x[2], 10) || 1 : 0, text: x[3] }); i++; }
          else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1].text += " " + lines[i].trim(); i++; }
          else if (!lines[i].trim() && i + 1 < lines.length && LIST.test(lines[i + 1])) i++;
          else break;
        }
        for (let k = 0; k < items.length;) { const [h, nk] = list(items, k); out += h; k = nk; }
        continue;
      }
      const p = [];
      while (i < lines.length && lines[i].trim() && !LIST.test(lines[i]) && !/^\s{0,3}#{1,6}\s/.test(lines[i]) && !/^\s*&gt;/.test(lines[i]) && !(lines[i].includes("|") && TSEP.test(lines[i + 1] || ""))) p.push(lines[i++]);
      if (!p.length) { p.push(lines[i++]); }
      out += `<p>${p.map(inline).join("<br>")}</p>`;
    }
    return out;
  }
  const isHtmlLang = l => /^(html?|xhtml|svg)$/i.test(l);
  function codeBlock(lang, code, open) {
    return `<div class="pl-code"><div class="pl-code-bar"><span>${esc(lang || "código")}</span>`
      + (isHtmlLang(lang) && !open ? `<button type="button" class="pl-run" data-act="preview">${icon("play", 13)}${T("Vista previa", "Preview")}</button>` : "")
      + `<button type="button" data-act="copy-code">${icon("copy", 13)}<span>${T("Copiar", "Copy")}</span></button></div><pre><code>${esc(code)}</code></pre></div>`;
  }
  function md(src, live) {
    let html = "", last = 0, m;
    const re = /^[ \t]*```([\w+#.-]*)[^\n]*\n([\s\S]*?)(^[ \t]*```[ \t]*$|$(?![\s\S]))/gm;
    while ((m = re.exec(src))) {
      html += blocks(src.slice(last, m.index));
      html += codeBlock(m[1], m[2].replace(/\n$/, ""), !m[3]);
      last = re.lastIndex;
      if (re.lastIndex === m.index) re.lastIndex++;
    }
    html += blocks(src.slice(last));
    if (live) html = /<\/p>$/.test(html) ? html.replace(/<\/p>$/, '<span class="pl-cursor"></span></p>') : html + '<span class="pl-cursor"></span>';
    return html;
  }
  const lastHtml = text => { let m, found = null; const re = /```(?:html?|xhtml)[^\n]*\n([\s\S]*?)```/gi; while ((m = re.exec(text))) found = m[1]; return found; };

  // ---------------- Conexión con el servidor ----------------
  const fail = (code, message) => Object.assign(new Error(message), { code });
  async function post(url, body, signal, onEvent) {
    let res;
    try { res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal, credentials: "same-origin" }); }
    catch (e) { if (e.name === "AbortError") throw e; throw fail("offline", T("Sin conexión. Revisá tu internet e intentá de nuevo.", "No connection. Check your internet and try again.")); }
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const d = await res.json().catch(() => ({}));
      if (!onEvent) { if (!res.ok || d.ok === false) throw fail(d.error || "error", d.message || "Error"); return d; }
      throw fail(d.error || "error", d.message || T("No pude responder. Intentá de nuevo.", "I couldn't answer. Please try again."));
    }
    if (!ct.includes("ndjson") || !res.body) throw fail("offline", T("CB Pilot necesita su servidor en línea.", "CB Pilot needs its online server."));
    const reader = res.body.getReader(), dec = new TextDecoder();
    let buf = "", done = null;
    for (;;) {
      const { value, done: end } = await reader.read();
      if (end) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let ev; try { ev = JSON.parse(line); } catch { continue; }
        if (ev.t === "error") throw fail(ev.code, ev.message);
        if (ev.t === "done") done = ev;
        onEvent(ev);
      }
    }
    if (!done) throw fail("cut", T("La respuesta se interrumpió. Probá de nuevo.", "The response was interrupted. Please try again."));
    return done;
  }
  /** Pide una respuesta completa: si el servidor corta por tiempo, pide la continuación sola. */
  async function ask(history, mode, signal, onText, onSources, extra = {}) {
    let text = "", cont = null, r;
    do {
      const seg = text;
      const body = cont ? { messages: history, partial: text, cont, mode, ...extra } : { messages: history, pass, mode, ...extra };
      r = await post("/api/pilot/chat", body, signal, ev => {
        if (ev.t === "d") { text += ev.v; onText(text); }
        else if (ev.t === "reset") { text = seg; onText(text); }
        else if (ev.t === "sources" && onSources) onSources(ev.items || []);
      });
      cont = r.cont;
      if (info && r.remaining !== null && r.remaining !== undefined) { info.usedToday = Math.max(0, info.perDay - r.remaining); info.usedMonth = r.usedMonth ?? info.usedMonth; renderPlan(); }
    } while (cont && !signal.aborted);
    return { text, stop: r.stop };
  }
  async function refreshStatus() {
    try { info = await post("/api/pilot/status", { pass }); if (pass && !info.passValid) { pass = null; write(K.pass, null); } }
    catch (e) { info = null; if (e.code === "offline") offline = e.message; }
    user = info?.user || null;
    renderAcct(); renderPlan();
    if (info?.requireAccount && !user && !(panel.open && panelKind === "welcome")) openAuth("register", true); $("#pl-model").textContent = info ? info.label : "CB Pilot";
    if (!current || !chatById(current)?.messages.length) renderThread();
  }
  let offline = null, user = null;
  const firstName = () => (user?.name || "").trim().split(/\s+/)[0];
  const activeCount = () => running.size;
  const busy = () => document.body.classList.toggle("is-thinking", running.size > 0); // el fondo vivo se intensifica
  const limit = () => (info ? info.parallel : 2);

  // ---------------- Chats ----------------
  const chatById = id => chats.find(c => c.id === id);
  const titleFrom = t => { const s = t.replace(/\s+/g, " ").trim(); return s.length > 52 ? s.slice(0, 50).trimEnd() + "…" : s; };
  function newChat() { const c = { id: uid(), title: T("Nuevo chat", "New chat"), created: Date.now(), updated: Date.now(), pinned: false, messages: [] }; chats.unshift(c); current = c.id; return c; }
  function openChat(id) { current = id; write(K.current, current); settings.assistant = chatById(id)?.assistant || "general"; syncPickers(); setView("chat"); renderList(); renderThread(true); closeSide(); $("#pl-input").focus({ preventScroll: true }); }

  function send(text) {
    text = text.trim();
    if (!text && !pend.length) return;
    if (pend.some(f => f.loading)) return note(T("Esperá un segundo: todavía estoy leyendo tus archivos.", "One second: still reading your files."));
    if (!text) text = T("Mirá el archivo adjunto.", "Take a look at the attached file.");
    let chat = chatById(current);
    if (!chat) chat = newChat();
    if (running.has(chat.id)) return;
    if (activeCount() >= limit()) return note(T(`Tu plan permite ${limit()} respuestas a la vez. Esperá a que termine una o mejorá tu plan.`, `Your plan allows ${limit()} responses at once. Wait for one to finish or upgrade.`));
    const msg = { role: "user", content: text };
    if (pend.length) { msg.files = pend.map(f => ({ kind: f.kind, name: f.name, thumb: f.thumb || "" })); fileData.set(msg, pend.map(({ kind, name, media, data, text }) => ({ kind, name, media, data, text }))); pend = []; renderAtts(); }
    chat.assistant = settings.assistant;
    chat.messages.push(msg);
    if (chat.messages.length === 1) chat.title = titleFrom(text);
    chat.updated = Date.now(); saveChats();
    $("#pl-input").value = ""; grow();
    runChat(chat);
  }
  async function runChat(chat) {
    const msgs = chat.messages.filter(m => m.content);
    const lastUser = [...msgs].reverse().find(m => m.role === "user");
    // Los archivos viajan solo con el último mensaje; los anteriores se mencionan por nombre para no gastar de más.
    const history = msgs.map(m => ({ role: m.role, content: m.files?.length && m !== lastUser ? `${m.content}\n[${T("Adjuntó", "Attached")}: ${m.files.map(f => f.name).join(", ")}]` : m.content }));
    const extra = { style: settings.style, habla: settings.habla, assistant: chat.assistant || "general", attachments: fileData.get(lastUser) || [] };
    const bot = { role: "assistant", content: "", pending: true, assistant: extra.assistant };
    chat.messages.push(bot);
    const ac = new AbortController(); running.set(chat.id, ac); busy();
    renderList(); if (chat.id === current) renderThread(true); syncComposer();
    try {
      const r = await ask(history, "chat", ac.signal, text => { bot.content = text; paint(chat.id); }, items => { bot.sources = items; }, extra);
      bot.stop = r.stop;
    } catch (e) {
      if (e.name === "AbortError") bot.stop = "stopped";
      else { bot.error = e.code || "error"; bot.errorMsg = e.message; if (["quota", "free_paused", "budget"].includes(e.code)) refreshStatus(); if (e.code === "login_required") openAuth("register", true); }
    } finally {
      delete bot.pending; running.delete(chat.id); busy(); chat.updated = Date.now(); saveChats();
      renderList(); syncComposer();
      if (chat.id === current) { renderThread(); if (!bot.error) autoPreview(bot.content); }
      if (!bot.error) $("#pl-live").textContent = T("Respuesta lista: ", "Response ready: ") + chat.title;
      pump();
    }
  }
  let paintQueued = new Set(), raf = 0;
  function paint(id) {
    paintQueued.add(id);
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      if (paintQueued.has(current) && view === "chat") {
        const chat = chatById(current), el = $("#pl-thread .pl-msg.bot:last-child .pl-body");
        const m = chat && chat.messages[chat.messages.length - 1];
        if (m && m.pending && el) { const sc = $("#pl-scroll"), stick = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140; el.innerHTML = md(m.content, true); if (stick) sc.scrollTop = sc.scrollHeight; }
      }
      if ([...paintQueued].some(id => tasks.some(t => t.id === id)) && view === "tasks") paintTasks();
      paintQueued.clear();
    });
  }

  // ---------------- Render: historial ----------------
  function renderList() {
    const box = $("#pl-list"), q = query.toLowerCase();
    const list = chats.filter(c => c.messages.length && (!q || c.title.toLowerCase().includes(q) || c.messages.some(m => m.content.toLowerCase().includes(q))));
    if (!list.length) { box.innerHTML = `<p class="pl-empty-list">${q ? T("Sin resultados.", "No results.") : T("Tus chats aparecen aquí. Se guardan solo en este dispositivo.", "Your chats appear here. They're stored only on this device.")}</p>`; return; }
    const day = 864e5, start = new Date().setHours(0, 0, 0, 0);
    const groups = [[T("Fijados", "Pinned"), c => c.pinned], [T("Hoy", "Today"), c => c.updated >= start], [T("Últimos 7 días", "Last 7 days"), c => c.updated >= start - 6 * day], [T("Anteriores", "Older"), () => true]];
    const used = new Set(); let html = "";
    for (const [label, test] of groups) {
      const g = list.filter(c => !used.has(c.id) && test(c)); if (!g.length) continue;
      g.forEach(c => used.add(c.id));
      html += `<div class="pl-group">${label}</div>` + g.map(c => `<div class="pl-item${c.id === current && view === "chat" ? " is-active" : ""}" data-id="${c.id}">
        <a href="#chat" data-act="open">${running.has(c.id) ? '<i class="pl-dot" aria-label="Respondiendo"></i>' : ""}<span>${esc(c.title)}</span></a>
        <div class="pl-acts"><button type="button" data-act="pin" aria-label="${c.pinned ? T("Desfijar", "Unpin") : T("Fijar", "Pin")}" title="${c.pinned ? T("Desfijar", "Unpin") : T("Fijar", "Pin")}">${icon("pin", 14)}</button><button type="button" data-act="rename" aria-label="${T("Renombrar", "Rename")}" title="${T("Renombrar", "Rename")}">${icon("edit", 14)}</button><button type="button" data-act="delete" aria-label="${T("Eliminar", "Delete")}" title="${T("Eliminar", "Delete")}">${icon("trash", 14)}</button></div></div>`).join("");
    }
    box.innerHTML = html;
  }

  // ---------------- Render: conversación ----------------
  const CHIPS = [
    ["🎨", "La landing de mi soda", "A landing for my diner", "Con vista previa en vivo", "With a live preview", "Diseñá una landing moderna para una soda típica en Cartago llamada «La Esquina de Doña Flor», con casados, gallo pinto, horario y botón de WhatsApp.", "Design a modern landing page for a traditional Costa Rican diner in Cartago called “La Esquina de Doña Flor”, with casados, gallo pinto, opening hours and a WhatsApp button."],
    ["📣", "Posts para mi emprendimiento", "Posts for my business", "Textos y hashtags con sabor tico", "Copy and hashtags with local flavor", "Escribí 5 posts para Instagram de una panadería en Heredia, con tono tico, emojis y hashtags.", "Write 5 Instagram posts for a bakery in Heredia, Costa Rica, with a friendly tone, emojis and hashtags."],
    ["🧾", "Facturación electrónica", "E-invoicing", "Explicado sencillo", "Explained simply", "Explicame en palabras sencillas qué necesito para empezar a facturar electrónicamente como emprendedor en Costa Rica.", "Explain in simple words what I need to start e-invoicing as a small business in Costa Rica."],
    ["🎪", "Vender más en la feria", "Sell more at the fair", "Precios, montaje e ideas", "Prices, booth and ideas", "Armame un plan para vender más en una feria de emprendedores este fin de semana: qué llevar, precios en colones y cómo atraer gente al puesto.", "Make me a plan to sell more at a local makers' fair this weekend: what to bring, prices in colones and how to attract people to my booth."],
    ["💻", "Ayuda con código", "Help with code", "Explicado con ejemplos", "Explained with examples", "Explicame paso a paso cómo usar fetch en JavaScript, con un ejemplo que pueda copiar.", "Explain step by step how to use fetch in JavaScript, with an example I can copy."],
    ["🌎", "Inglés para turistas", "English for tourists", "Atendé clientes de afuera", "Serve foreign customers", "Traducí al inglés estos mensajes para atender turistas en mi tour de rafting en Turrialba: bienvenida, precios y qué deben llevar.", "Translate into Spanish these messages for tourists on my rafting tour in Turrialba, Costa Rica: welcome, prices and what to bring."]
  ];


  function hello() {
    const warn = offline || (info && !info.available ? info.reason : "");
    return `<div class="pl-hello"><div class="pl-pilo">${pilo("pilo-hero")}</div>
      <h2>${user ? T(`¡Pura vida, <span class='grad'>${esc(firstName())}</span>!`, `Pura vida, <span class='grad'>${esc(firstName())}</span>!`) : T("¡Pura <span class='grad'>vida</span>!", "Pura <span class='grad'>vida</span>!")}</h2>
      <p class="pl-sub">${T("Soy Pilo, su copiloto de IA", "I'm Pilo, your AI copilot")}</p>
      <p class="pl-lead">${T("Estoy aquí para ayudarle a conversar, aprender, crear, programar y sacar adelante sus proyectos. Hecho en Costa Rica 🇨🇷.", "I'm here to help you chat, learn, create, code and move your projects forward. Made in Costa Rica 🇨🇷.")}</p>
      ${warn ? `<p class="form-msg" role="status">${esc(warn)}</p>` : ""}
      <div class="pl-examples">${CHIPS.slice(0, 4).map((c, i) => `<button type="button" class="pl-ex" data-chip="${i}">${c[0]} ${T(c[1], c[2])}</button>`).join("")}</div></div>`;
  }
  // Fuentes de la base de conocimiento que se consultaron para responder.
  const sourcesHTML = list => `<div class="pl-srcs"><span>${T("Fuentes consultadas", "Sources")}</span>${list.map(x => {
    const url = x.url && safeUrl(x.url);
    return url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(x.title)}</a>` : `<b>${esc(x.title)}</b>`;
  }).join("")}</div>`;
  function msgHTML(m, i, chat, { isLast, lastUser }) {
    if (m.role === "user") {
      const canEdit = lastUser && !running.has(chat.id);
      const files = m.files?.length ? `<div class="pl-ufiles">${m.files.map(f => f.thumb ? `<img src="${esc(f.thumb)}" alt="${esc(f.name)}" title="${esc(f.name)}">` : `<span class="pl-fchip">${fileIcon(f.kind)} ${esc(f.name)}</span>`).join("")}</div>` : "";
      return `<div class="pl-msg user" data-i="${i}">${files}<div class="pl-bubble">${esc(m.content)}</div>${canEdit ? `<div class="pl-tools"><button type="button" data-act="edit">${icon("edit")}${T("Editar", "Edit")}</button></div>` : ""}</div>`;
    }
    const live = m.pending && running.has(chat.id);
    let body = m.content ? md(m.content, live) : live ? '<span class="pl-typing" aria-label="Escribiendo"><i></i><i></i><i></i></span>' : "";
    if (m.error) body += `<p class="form-msg pl-retry" role="alert">${esc(m.errorMsg || "Error")}</p>`;
    if (!live && m.sources?.length) body += sourcesHTML(m.sources);
    let tools = "";
    if (!live) {
      const b = (act, ic, label, extra = "") => `<button type="button" data-act="${act}"${extra}>${icon(ic)}<span>${label}</span></button>`;
      if (m.content) tools += b("copy", "copy", T("Copiar", "Copy"));
      if (m.error && ["quota", "free_paused"].includes(m.error)) tools += b("plans", "pin", T("Ver planes", "See plans"));
      if (isLast) tools += b("regen", "regen", m.error ? T("Reintentar", "Retry") : T("Regenerar", "Regenerate"));
      if (isLast && m.content && !m.error && (m.stop === "max_tokens" || m.stop === null)) tools += b("continue", "more", T("Continuar", "Continue"));
      if (m.content && lastHtml(m.content)) tools += b("preview-last", "play", T("Vista previa", "Preview"));
      if (m.content) tools += `<button type="button" data-act="rate" data-v="up" aria-label="${T("Buena respuesta", "Good response")}" aria-pressed="${m.rating === "up"}">${icon("up")}</button><button type="button" data-act="rate" data-v="down" aria-label="${T("Mala respuesta", "Bad response")}" aria-pressed="${m.rating === "down"}">${icon("down")}</button>`;
    }
    return `<div class="pl-msg bot${live ? " is-live" : ""}${m.error ? " error" : ""}" data-i="${i}"><span class="pl-ava" aria-hidden="true">${pilo()}</span><div class="pl-who">Pilo${m.assistant && m.assistant !== "general" && ASSIST[m.assistant] ? ` · ${esc(T(ASSIST[m.assistant][1], ASSIST[m.assistant][2]))}` : ""}</div><div class="pl-body md">${body}</div>${tools ? `<div class="pl-tools">${tools}</div>` : ""}</div>`;
  }
  function renderThread(toBottom) {
    const chat = chatById(current), box = $("#pl-thread");
    $("#pl-title").textContent = chat && chat.messages.length ? chat.title : "CB Pilot";
    $("#pl-chat").classList.toggle("is-empty", !chat || !chat.messages.length);
    if (!chat || !chat.messages.length) { box.innerHTML = hello(); syncComposer(); return; }
    const n = chat.messages.length, lastUser = chat.messages.map(m => m.role).lastIndexOf("user");
    box.innerHTML = chat.messages.map((m, i) => msgHTML(m, i, chat, { isLast: i === n - 1, lastUser: i === lastUser })).join("");
    if (toBottom) { const sc = $("#pl-scroll"); sc.style.scrollBehavior = "auto"; sc.scrollTop = sc.scrollHeight; sc.style.scrollBehavior = ""; }
    syncComposer();
  }
  function syncComposer() {
    const busy = running.has(current), btn = $("#pl-send");
    btn.classList.toggle("is-stop", busy);
    btn.innerHTML = icon(busy ? "stop" : "send", 20);
    btn.setAttribute("aria-label", busy ? T("Detener", "Stop") : T("Enviar", "Send"));
  }
  const grow = () => { const t = $("#pl-input"); t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 220) + "px"; };
  function note(text, ok = false) {
    const box = $("#pl-thread"); const p = document.createElement("p");
    p.className = "form-msg" + (ok ? " ok" : ""); p.setAttribute("role", "status"); p.textContent = text;
    box.append(p); setTimeout(() => p.remove(), 6000);
    const sc = $("#pl-scroll"); sc.scrollTop = sc.scrollHeight;
  }

  // ---------------- Modo Tareas ----------------
  // Rutas: paquetes de tareas con nombres de lugares de Costa Rica.
  const PACKS = [
    [T("🌋 Ruta Arenal · Lanzá tu negocio", "🌋 Arenal route · Launch your business"), [T("Proponé 10 nombres y 5 eslóganes para [mi negocio]", "Suggest 10 names and 5 slogans for [my business]"), T("Escribí la propuesta de valor de [mi negocio] en 3 versiones", "Write [my business]'s value proposition in 3 versions"), T("Armá un plan de lanzamiento de 30 días para [mi negocio] en Costa Rica", "Make a 30-day launch plan for [my business] in Costa Rica")]],
    [T("🌿 Ruta Monteverde · Tus redes", "🌿 Monteverde route · Your socials"), [T("Escribí 10 ideas de posts para Instagram para [mi negocio], con texto y hashtags", "Write 10 Instagram post ideas for [my business], with copy and hashtags"), T("Redactá 5 textos cortos para estados de WhatsApp de [mi negocio]", "Write 5 short WhatsApp status texts for [my business]"), T("Proponé un calendario de contenido de 2 semanas para [mi negocio]", "Propose a 2-week content calendar for [my business]")]],
    [T("🏖️ Ruta Manuel Antonio · Tu web", "🏖️ Manuel Antonio route · Your website"), [T("Redactá la portada de la web de [mi negocio]: título, subtítulo y 3 beneficios", "Write the homepage of [my business]: headline, subheadline and 3 benefits"), T("Escribí la sección «Sobre nosotros» de [mi negocio]", "Write the “About us” section for [my business]"), T("Creá 8 preguntas frecuentes con respuesta para [mi negocio]", "Create 8 FAQs with answers for [my business]")]],
    [T("💰 Ruta Limón · Ventas", "💰 Limón route · Sales"), [T("Escribí un mensaje de WhatsApp para responder a un cliente que pregunta precios de [mi negocio]", "Write a WhatsApp reply for a customer asking about prices at [my business]"), T("Creá una promoción para [mi negocio] con 3 variantes de texto y precios en colones", "Create a promotion for [my business] with 3 copy variants and prices in colones"), T("Escribí un mensaje de agradecimiento para clientes que pagaron por SINPE en [mi negocio]", "Write a thank-you message for customers who paid via SINPE at [my business]")]],
    [T("📚 Ruta Cartago · Estudio", "📚 Cartago route · Study"), [T("Resumí en 10 puntos clave el tema: [tema]", "Summarize in 10 key points: [topic]"), T("Creá un plan de estudio de 7 días sobre [tema]", "Create a 7-day study plan about [topic]"), T("Hacé 10 preguntas de práctica con respuestas sobre [tema]", "Write 10 practice questions with answers about [topic]")]]
  ];

  function renderPacks() { $("#pl-packs").innerHTML = PACKS.map((p, i) => `<button type="button" data-pack="${i}">${esc(p[0])}</button>`).join(""); hint(); }
  function hint() { $("#pl-task-hint").textContent = T(`Hasta ${limit()} tareas a la vez en tu plan · máximo 10 por envío`, `Up to ${limit()} tasks at once on your plan · max 10 per batch`); }
  function launch(text) {
    const lines = text.split("\n").map(s => s.replace(/^\s*([-*•]|\d+[.)])\s*/, "").trim()).filter(Boolean);
    if (!lines.length) return;
    if (lines.length > 10) return taskMsg(T("Máximo 10 tareas por envío.", "Max 10 tasks per batch."));
    if (lines.some(l => /\[(mi negocio|tema|my business|topic)\]/i.test(l))) return taskMsg(T("Reemplazá [mi negocio] o [tema] por tu caso real antes de lanzar.", "Replace [my business] or [topic] with your real case before launching."));
    const t0 = Date.now();
    tasks.unshift(...lines.map((prompt, i) => ({ id: uid(), prompt, status: "queued", content: "", created: t0, seq: t0 * 100 + i })));
    $("#pl-task-input").value = ""; saveTasks(); paintTasks(); pump();
  }
  function taskMsg(text) { const h = $("#pl-task-hint"); h.textContent = text; h.style.color = "#fca5a5"; setTimeout(() => { h.style.color = ""; hint(); }, 5000); }
  function pump() {
    const queued = tasks.filter(t => t.status === "queued").sort((a, b) => (a.seq || a.created) - (b.seq || b.created)); // en el orden en que se escribieron
    for (const t of queued) { if (activeCount() >= limit()) break; runTask(t); }
  }
  async function runTask(t) {
    const ac = new AbortController(); running.set(t.id, ac); busy();
    t.status = "running"; t.content = ""; delete t.error; saveTasks(); paintTasks();
    try { const r = await ask([{ role: "user", content: t.prompt }], "task", ac.signal, text => { t.content = text; paint(t.id); }, items => { t.sources = items; }, { habla: settings.habla }); t.status = "done"; t.stop = r.stop; }
    catch (e) { t.status = "error"; t.error = e.name === "AbortError" ? T("Cancelada.", "Cancelled.") : e.message; if (e.code === "quota") tasks.filter(x => x.status === "queued").forEach(x => { x.status = "error"; x.error = e.message; }); }
    finally { running.delete(t.id); busy(); saveTasks(); paintTasks(); renderList(); pump(); }
  }
  const STATE = { queued: ["En pista", "On runway"], running: ["En vuelo", "In flight"], done: ["Aterrizó ✓", "Landed ✓"], error: ["Error", "Error"] };
  function paintTasks() {
    const board = $("#pl-board");
    if (!tasks.length) { board.innerHTML = `<p class="pl-board-empty">${T("Todavía no hay misiones en la torre. Escribí varias arriba (una por línea) o elegí una ruta.", "No missions in the tower yet. Write several above (one per line) or pick a route.")}</p>`; return; }
    const open = new Set($$(".pl-tcard.is-open", board).map(c => c.dataset.id));
    board.innerHTML = tasks.map(t => {
      const b = (act, ic, label) => `<button type="button" data-act="${act}">${icon(ic)}<span>${label}</span></button>`;
      let tools = "";
      if (t.status === "running" || t.status === "queued") tools = b("t-cancel", "trash", T("Cancelar", "Cancel"));
      else {
        if (t.content) tools += b("t-toggle", "more", open.has(t.id) ? T("Ver menos", "Less") : T("Ver todo", "Expand")) + b("t-copy", "copy", T("Copiar", "Copy")) + b("t-chat", "chat", T("Abrir como chat", "Open as chat"));
        if (t.content && lastHtml(t.content)) tools += b("t-preview", "play", T("Vista previa", "Preview"));
        if (t.status === "error") tools += b("t-retry", "regen", T("Reintentar", "Retry"));
        tools += b("t-delete", "trash", T("Quitar", "Remove"));
      }
      const live = t.status === "running";
      return `<article class="pl-tcard${live ? " is-running" : ""}${t.status === "error" ? " is-error" : ""}${open.has(t.id) ? " is-open" : ""}" data-id="${t.id}">
        <div class="pl-tcard-top"><h4>${esc(t.prompt)}</h4><span class="pl-state ${t.status}">${T(...STATE[t.status])}</span></div>
        ${t.content ? `<div class="md">${md(t.content, live)}</div>` : live ? '<span class="pl-typing"><i></i><i></i><i></i></span>' : ""}
        ${t.error ? `<p class="form-msg">${esc(t.error)}</p>` : ""}
        ${!live && t.sources?.length ? sourcesHTML(t.sources) : ""}
        <div class="pl-tools">${tools}</div></article>`;
    }).join("");
  }

  // ---------------- Vista previa ----------------
  let canvasHtml = "";
  function openPreview(html) {
    canvasHtml = html; $("#pl-frame").srcdoc = html;
    $("#pl-canvas").hidden = false; root.classList.add("has-canvas");
  }
  function closePreview() { $("#pl-canvas").hidden = true; root.classList.remove("has-canvas"); $("#pl-frame").srcdoc = ""; }
  function autoPreview(text) { const h = lastHtml(text); if (h && /<(html|body|!doctype|section|main)/i.test(h) && innerWidth > 1180) openPreview(h); }

  // ---------------- Planes ----------------
  const planName = k => (k === "gratis" ? T("Gratis", "Free") : info?.plans?.[k]?.name || k);
  // Medidor de combustible estilo tablero de avión: muestra cuánto uso le queda hoy.
  function fuelGauge(left) {
    const len = 113.1, ang = -90 + left * 1.8;
    return `<div class="pl-fuel${left <= 20 ? " is-low" : ""}" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${left}" aria-label="${T("Combustible de hoy", "Today's fuel")}">
      <svg viewBox="0 0 86 50" aria-hidden="true"><defs><linearGradient id="pl-fuel-grad" x1="0" x2="1"><stop offset="0" stop-color="#ef4444"/><stop offset=".35" stop-color="#f59e0b"/><stop offset="1" style="stop-color:rgb(var(--a2))"/></linearGradient></defs>
        <path class="g-bg" d="M7 44a36 36 0 0 1 72 0" fill="none" stroke-width="7" stroke-linecap="round"/>
        <path class="g-val" d="M7 44a36 36 0 0 1 72 0" fill="none" stroke-width="7" stroke-linecap="round" stroke-dasharray="${len}" stroke-dashoffset="${(len * (100 - left) / 100).toFixed(1)}"/>
        <g class="g-needle" style="transform:rotate(${ang}deg)"><path d="M43 44V14" stroke="var(--strong)" stroke-width="2.4" stroke-linecap="round"/></g><circle cx="43" cy="44" r="4" fill="var(--strong)"/>
        <text x="4" y="50" font-size="7" fill="var(--gray)" font-family="monospace">E</text><text x="77" y="50" font-size="7" fill="var(--gray)" font-family="monospace">F</text></svg>
      <div class="pl-fuel-txt"><small>${T("Combustible", "Fuel")}</small><b>${left} %</b><span>${T("para hoy", "for today")}</span></div></div>`;
  }
  function renderPlan() {
    const box = $("#pl-plan");
    if (!info) { box.innerHTML = `<small>${esc(offline || T("Conectando…", "Connecting…"))}</small>`; return; }
    const pct = info.perDay ? Math.min(100, Math.round(info.usedToday / info.perDay * 100)) : 0;
    const mpct = info.perMonth ? Math.min(100, Math.round(info.usedMonth / info.perMonth * 100)) : null;
    box.innerHTML = `<div class="pl-plan-row"><span class="pl-badge ${info.plan}">${T("Plan", "Plan")} ${esc(planName(info.plan))}</span><small>${esc(info.label)}</small></div>
      ${fuelGauge(100 - pct)}
      <small>${pct >= 100 ? T("Sin combustible: se recarga a medianoche ⛽", "Out of fuel: refills at midnight ⛽") : mpct !== null ? T(`Uso del mes: ${mpct} %`, `Monthly usage: ${mpct}%`) : T("Se recarga todos los días a medianoche ⛽", "Refills every day at midnight ⛽")}</small>
      <button type="button" class="pl-upgrade" data-act="plans">${info.plan === "gratis" ? T("✦ Mejorar plan", "✦ Upgrade plan") : T("Ver mi plan", "View my plan")}</button>`;
    hint();
  }
  const crc = n => "₡" + Number(n).toLocaleString(A.lang === "en" ? "en-US" : "es-CR");
  function openPlans() {
    const p = info?.plans || {}, cur = info?.plan || "gratis";
    const times = k => String(Math.round(((p[k]?.perDay || 1) / (p.gratis?.perDay || 1)) * 10) / 10).replace(".", A.lang === "en" ? "." : ",");
    const FEAT = {
      gratis: [T("Pilot Flash: rápido y eficiente", "Pilot Flash: fast and efficient"), T("Uso diario incluido, se renueva cada día", "Daily usage included, renews every day"), T("2 respuestas o tareas a la vez", "2 responses or tasks at once"), T("Vista previa de diseños HTML", "HTML design preview"), T("Historial privado en tu dispositivo", "Private history on your device")],
      pro: [T("Pilot Pro: respuestas más inteligentes", "Pilot Pro: smarter answers"), T(`${times("pro")}× más uso diario que Gratis`, `${times("pro")}× more daily usage than Free`), T("4 respuestas o tareas a la vez", "4 responses or tasks at once"), T("Respuestas más largas y más memoria", "Longer answers and more memory"), T("Ideal para trabajo y estudio diario", "Ideal for daily work and study")],
      max: [T("Pilot Max: el modelo más potente", "Pilot Max: the most powerful model"), T(`${times("max")}× más uso diario que Gratis`, `${times("max")}× more daily usage than Free`), T("6 respuestas o tareas a la vez", "6 responses or tasks at once"), T("Razonamiento profundo para tareas complejas", "Deep reasoning for complex tasks"), T("Memoria más amplia de la conversación", "Largest conversation memory")]
    };
    const card = k => {
      const price = k === "gratis" ? `${crc(0)} <small>${T("para siempre", "forever")}</small>` : p[k]?.price ? `${crc(p[k].price)} <small>${T("/ mes", "/ month")}</small>` : `<small>${T("Precio por WhatsApp", "Price on WhatsApp")}</small>`;
      const wa = `https://wa.me/${info?.whatsapp || ""}?text=${encodeURIComponent(T(`Hola, quiero el plan ${p[k]?.name || k} de CB Pilot.`, `Hi, I want the CB Pilot ${p[k]?.name || k} plan.`))}`;
      const cta = k === cur ? `<button class="btn btn-ghost" type="button" disabled>${T("Tu plan actual", "Your current plan")}</button>` : k === "gratis" ? "" : `<a class="btn btn-primary" href="${wa}" target="_blank" rel="noopener noreferrer">${T("Quiero", "I want")} ${esc(p[k]?.name || k)}</a>`;
      return `<div class="pl-pcard${k === "pro" ? " is-best" : ""}${k === cur ? " is-current" : ""}">${k === "pro" ? `<span class="pl-ribbon">${T("Recomendado", "Recommended")}</span>` : ""}<h3>${esc(planName(k))}</h3><div class="pl-price">${price}</div><ul>${FEAT[k].map(f => `<li>${esc(f)}</li>`).join("")}</ul>${cta}</div>`;
    };
    $("#pl-plans-body").innerHTML = `<div class="pl-dialog-head"><div><span class="eyebrow">CB Pilot</span><h2 id="pl-plans-title">${T("Elegí tu <span class='grad'>plan</span>", "Choose your <span class='grad'>plan</span>")}</h2></div><button type="button" class="pl-icon" data-close aria-label="${T("Cerrar", "Close")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <div class="pl-plans">${["gratis", "pro", "max"].map(card).join("")}</div>
      <p class="muted">${T("Pagás por SINPE Móvil y te enviamos un código de acceso para activar tu plan en cualquier dispositivo.", "Pay via SINPE Móvil and we'll send you an access code to activate your plan on any device.")}</p>
      <p class="muted">${user ? T("Al activar un código con tu sesión iniciada, el plan queda en tu cuenta y lo usás en todos tus dispositivos.", "When you activate a code while signed in, the plan is saved to your account and works on all your devices.") : T("Consejo: <button type='button' class='pl-link' data-act='auth'>creá una cuenta gratis</button> para usar tu plan en todos tus dispositivos.", "Tip: <button type='button' class='pl-link' data-act='auth'>create a free account</button> to use your plan on all your devices.")}</p>
      ${user && info?.plan !== "gratis" && info?.expiresAt ? `<p class="form-msg ok">${T("Plan", "Plan")} ${esc(planName(info.plan))} ${T("activo en tu cuenta hasta", "active on your account until")} ${new Date(info.expiresAt).toLocaleDateString(A.lang === "en" ? "en-US" : "es-CR")}.</p>` : ""}
      ${info?.passValid ? `<p class="form-msg ok">${T("Plan", "Plan")} ${esc(planName(info.plan))} ${T("activo hasta", "active until")} ${new Date(info.expiresAt).toLocaleDateString(A.lang === "en" ? "en-US" : "es-CR")}. <button type="button" class="pl-link" data-act="logout">${T("Quitar el código de este dispositivo", "Remove the code from this device")}</button></p>` : ""}
      <form class="pl-activate" id="pl-activate"><div class="field"><label for="pl-code">${T("¿Ya tenés un código?", "Already have a code?")}</label><input id="pl-code" placeholder="CBP-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false" required></div><button class="btn btn-primary" type="submit">${T("Activar", "Activate")}</button></form><div id="pl-act-msg"></div>`;
    const dlg = $("#pl-plans"); if (!dlg.open) dlg.showModal();
  }

  // ---------------- Vista y paneles ----------------
  function setView(v) {
    view = v; $("#pl-chat").hidden = v !== "chat"; $("#pl-tasks").hidden = v !== "tasks";
    $$(".pl-nav [data-view]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.view === v)));
    if (v === "tasks") { $("#pl-title").textContent = T("Torre de control", "Control tower"); paintTasks(); }
    else renderThread();
    renderList();
  }
  const side = $("#pl-side"), scrim = $("#pl-scrim");
  function openSide() { side.classList.add("is-open"); scrim.hidden = false; }
  function closeSide() { side.classList.remove("is-open"); scrim.hidden = true; }

  // ---------------- Caja de texto: modo, asistente, adjuntos y voz ----------------
  const settings = { style: read("cbpilot-style", "rapido") === "detallado" ? "detallado" : "rapido", assistant: "general", habla: ["tico", "neutro", "formal"].includes(read("cbpilot-habla", "tico")) ? read("cbpilot-habla", "tico") : "tico" };
  const MODES = { rapido: ["✈️", "Crucero", "Cruise", "Rápido y directo al grano", "Fast and to the point"], detallado: ["🚀", "Turbo", "Turbo", "Más completo y profundo", "Deeper and more complete"] };
  const ASSIST = {
    general: ["✦", "General", "General", "Para todo", "For anything"],
    web: ["🎨", "Diseñador web", "Web designer", "Páginas completas con vista previa", "Full pages with live preview"],
    code: ["💻", "Programador", "Developer", "Código completo y explicado", "Complete, explained code"],
    marketing: ["📣", "Marketing y redes", "Marketing & social", "Posts, campañas y estrategia", "Posts, campaigns and strategy"],
    tutor: ["📚", "Profe", "Tutor", "Explica paso a paso", "Explains step by step"],
    writer: ["✍️", "Redactor", "Writer", "Textos, correos y guiones", "Copy, emails and scripts"]
  };
  // Mundos: hoy cambian la paleta y la iluminación; los paisajes animados llegan en las próximas fases.
  const WORLDS = [
    ["original", "CB Pilot Original", "CB Pilot Original", "La cabina tecnológica de CeBe Studio: azul profundo y luz eléctrica.", "CeBe Studio's tech cockpit: deep blue and electric light."],
    ["selva", "Selva costarricense", "Costa Rican rainforest", "Verdes del bosque tropical con destellos de sol.", "Tropical forest greens with sun flares."],
    ["arenal", "Volcán Arenal", "Arenal Volcano", "Tonos cálidos de lava, roca y atardecer.", "Warm lava, rock and dusk tones."],
    ["caribe", "Caribe costarricense", "Costa Rican Caribbean", "Turquesa del mar y arena tropical.", "Turquoise sea and tropical sand."],
    ["pacifico", "Atardecer del Pacífico", "Pacific sunset", "Naranjas, rosados y violetas del atardecer.", "Sunset oranges, pinks and violets."],
    ["bandera", "Bandera de Costa Rica", "Costa Rican flag", "Azul, blanco y rojo con estética tecnológica.", "Blue, white and red with a tech look."]
  ];
  function syncPickers() {
    const m = MODES[settings.style], a = ASSIST[settings.assistant] || ASSIST.general;
    $("#pl-mode").innerHTML = `<span aria-hidden="true">${m[0]}</span>${esc(T(m[1], m[2]))}`;
    $("#pl-mode").setAttribute("aria-label", T("Modo de respuesta: ", "Response mode: ") + T(m[1], m[2]));
    $("#pl-assist").innerHTML = `<span aria-hidden="true">${a[0]}</span>${esc(T(a[1], a[2]))}`;
    $("#pl-assist").setAttribute("aria-label", T("Asistente: ", "Assistant: ") + T(a[1], a[2]));
    $("#pl-assist").classList.toggle("is-on", settings.assistant !== "general");
  }

  // Menú emergente (modo, asistente, apariencia)
  const menu = $("#pl-menu"); let menuFor = null;
  function closeMenu() { menu.hidden = true; menuFor?.setAttribute("aria-expanded", "false"); menuFor = null; }
  function openMenu(btn, html, onClick) {
    if (menuFor === btn) return closeMenu();
    closeMenu(); menuFor = btn; btn.setAttribute("aria-expanded", "true");
    menu.innerHTML = html; menu.hidden = false; menu.onclick = e => { const it = e.target.closest("[data-v]"); if (it) onClick(it.dataset.v, it); };
    const r = btn.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    menu.style.top = (r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8) + "px";
    menu.querySelector("[aria-checked=true], [data-v]")?.focus();
  }
  const item = (v, [ic, es, en, des, den], on) => `<button type="button" class="pl-mi" role="menuitemradio" aria-checked="${on}" data-v="${v}"><span class="pl-mi-ic" aria-hidden="true">${ic}</span><span><b>${esc(T(es, en))}</b><small>${esc(T(des, den))}</small></span></button>`;
  $("#pl-mode").addEventListener("click", e => openMenu(e.currentTarget, `<p class="pl-mh">${T("Modo de respuesta", "Response mode")}</p>` + Object.entries(MODES).map(([k, v]) => item(k, v, k === settings.style)).join(""), v => { settings.style = v; write("cbpilot-style", v); syncPickers(); closeMenu(); }));
  $("#pl-assist").addEventListener("click", e => openMenu(e.currentTarget, `<p class="pl-mh">${T("Asistente", "Assistant")}</p>` + Object.entries(ASSIST).map(([k, v]) => item(k, v, k === settings.assistant)).join(""), v => {
    settings.assistant = v; const c = chatById(current); if (c && !running.has(c.id)) { c.assistant = v; saveChats(); }
    syncPickers(); closeMenu(); $("#pl-input").focus();
  }));
  // (un botón que se volvió a dibujar dentro del menú ya no está en la página: no cuenta como "clic afuera")
  document.addEventListener("click", e => { if (menuFor && e.target.isConnected && !menu.contains(e.target) && !menuFor.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && menuFor) { const b = menuFor; closeMenu(); b.focus(); } });
  addEventListener("resize", closeMenu);

  // Adjuntos: las fotos se achican en el navegador; PDF y archivos de texto se leen aquí y viajan con el mensaje.
  let pend = [];
  const fileData = new WeakMap(); // datos completos del adjunto (no se guardan en el historial)
  const TEXT_EXT = /\.(txt|md|markdown|csv|json|js|mjs|ts|tsx|jsx|py|html?|css|xml|sql|java|php|c|cpp|h|cs|rb|go|rs|yml|yaml|ini|log)$/i;
  function fileIcon(kind) { return kind === "image" ? "🖼️" : kind === "pdf" ? "📄" : "📝"; }
  function renderAtts() {
    const box = $("#pl-atts"); box.hidden = !pend.length;
    box.innerHTML = pend.map((f, i) => `<span class="pl-att${f.loading ? " is-loading" : ""}">${f.thumb ? `<img src="${esc(f.thumb)}" alt="">` : `<i aria-hidden="true">${fileIcon(f.kind)}</i>`}<span>${esc(f.name)}</span><button type="button" data-rm="${i}" aria-label="${T("Quitar", "Remove")} ${esc(f.name)}">×</button></span>`).join("");
  }
  const readAs = (file, how) => new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => bad(r.error); r[how](file); });
  async function shrink(file, max, q) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", q);
    } finally { URL.revokeObjectURL(url); }
  }
  async function addFiles(list) {
    for (const file of [...list]) {
      if (pend.length >= 5) { note(T("Máximo 5 archivos por mensaje.", "Max 5 files per message.")); break; }
      const isImg = /^image\/(jpeg|png|webp|gif|bmp|avif)$/.test(file.type), isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      if (!isImg && !isPdf && !TEXT_EXT.test(file.name) && !file.type.startsWith("text/")) { note(T(`«${file.name}»: por ahora acepto fotos, PDF y archivos de texto o código.`, `“${file.name}”: I accept photos, PDF and text or code files for now.`)); continue; }
      if (isPdf && file.size > 4 * 1024 * 1024) { note(T(`«${file.name}» pesa más de 4 MB.`, `“${file.name}” is over 4 MB.`)); continue; }
      const f = { kind: isImg ? "image" : isPdf ? "pdf" : "text", name: file.name.slice(-80), loading: true };
      pend.push(f); renderAtts();
      try {
        if (isImg) { const big = await shrink(file, 1568, .86); f.media = "image/jpeg"; f.data = big.split(",")[1]; f.thumb = await shrink(file, 160, .7); }
        else if (isPdf) f.data = String(await readAs(file, "readAsDataURL")).split(",")[1];
        else { const t = String(await readAs(file, "readAsText")); f.text = t.slice(0, 150000); if (t.length > 150000) note(T(`«${file.name}» es muy largo: uso los primeros 150 000 caracteres.`, `“${file.name}” is long: using the first 150,000 characters.`)); }
        delete f.loading;
      } catch { pend = pend.filter(x => x !== f); note(T(`No pude leer «${file.name}».`, `Couldn't read “${file.name}”.`)); }
      renderAtts();
    }
  }
  $("#pl-attach").addEventListener("click", () => $("#pl-file").click());
  $("#pl-file").addEventListener("change", e => { addFiles(e.target.files); e.target.value = ""; });
  $("#pl-atts").addEventListener("click", e => { const b = e.target.closest("[data-rm]"); if (b) { pend.splice(+b.dataset.rm, 1); renderAtts(); } });
  $("#pl-input").addEventListener("paste", e => { const fs = [...(e.clipboardData?.files || [])]; if (fs.length) { e.preventDefault(); addFiles(fs); } });
  const chatView = $("#pl-chat"), drop = $("#pl-drop"); let dragN = 0;
  chatView.addEventListener("dragenter", e => { if ([...e.dataTransfer.types].includes("Files")) { dragN++; drop.hidden = false; } });
  chatView.addEventListener("dragleave", () => { if (--dragN <= 0) { dragN = 0; drop.hidden = true; } });
  chatView.addEventListener("dragover", e => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  chatView.addEventListener("drop", e => { e.preventDefault(); dragN = 0; drop.hidden = true; if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files); });

  // Dictado por voz (si el navegador lo permite; en Brave suele estar bloqueado)
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let rec = null;
  if (Rec) {
    const mic = $("#pl-mic"); mic.hidden = false;
    mic.addEventListener("click", () => {
      if (rec) return rec.stop();
      const input = $("#pl-input"), base = input.value ? input.value.replace(/\s*$/, " ") : "";
      rec = new Rec(); rec.lang = A.lang === "en" ? "en-US" : "es-CR"; rec.interimResults = true; rec.continuous = true;
      rec.onresult = ev => { input.value = base + [...ev.results].map(r => r[0].transcript).join(""); grow(); };
      rec.onerror = ev => { if (ev.error === "not-allowed" || ev.error === "service-not-allowed" || ev.error === "network") note(T("El dictado por voz no está disponible en este navegador (en Brave suele estar bloqueado). Probá en Chrome o Edge.", "Voice dictation isn't available in this browser (Brave usually blocks it). Try Chrome or Edge.")); };
      rec.onend = () => { rec = null; mic.classList.remove("is-rec"); mic.setAttribute("aria-pressed", "false"); };
      try { rec.start(); mic.classList.add("is-rec"); mic.setAttribute("aria-pressed", "true"); } catch { rec = null; }
    });
  }

  // ---------------- Acciones rápidas (con la conversación vacía) ----------------
  const QUICK = [["attach", "📎", "Analizar archivo", "Analyze a file"], ["doc", "📄", "Crear documento", "Write a document"], ["code", "💻", "Ayuda con código", "Help with code"], ["web", "🎨", "Diseñar una página", "Design a page"], ["biz", "💡", "Ideas de negocio", "Business ideas"]];
  function renderQuick() { $("#pl-quick").innerHTML = QUICK.map(([k, ic, es, en]) => `<button type="button" class="pl-qa" data-q="${k}"><span aria-hidden="true">${ic}</span>${esc(T(es, en))}</button>`).join(""); }
  function setAssistant(v) { settings.assistant = v; const c = chatById(current); if (c && !running.has(c.id)) { c.assistant = v; saveChats(); } syncPickers(); }
  function prefill(text) { const t = $("#pl-input"); t.value = text; grow(); t.focus(); t.setSelectionRange(text.length, text.length); }
  $("#pl-quick").addEventListener("click", e => {
    const b = e.target.closest("[data-q]"); if (!b) return;
    const k = b.dataset.q;
    if (k === "attach") return $("#pl-file").click();
    if (k === "doc") { setAssistant("writer"); prefill(T("Redácteme un documento sobre ", "Write me a document about ")); }
    if (k === "code") { setAssistant("code"); prefill(""); }
    if (k === "web") { setAssistant("web"); prefill(T("Diseñe una landing page para ", "Design a landing page for ")); }
    if (k === "biz") { setAssistant("marketing"); prefill(T("Deme ideas para hacer crecer mi negocio de ", "Give me ideas to grow my business of ")); }
  });

  // ---------------- Paneles: mundos, cabina de mando, configuración y bienvenida ----------------
  const panel = $("#pl-panel"); let panelKind = null;
  const closeX = `<button type="button" class="pl-icon pl-auth-x" data-close aria-label="${T("Cerrar", "Close")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`;
  const seg3 = (key, cur, opts) => `<div class="pl-seg3" role="group" style="grid-template-columns:repeat(${opts.length},1fr)">${opts.map(([v, label]) => `<button type="button" data-set="${key}:${v}" aria-pressed="${cur === v}">${label}</button>`).join("")}</div>`;
  const ahorroOn = () => !!window.CBPILOT_THEME?.ahorro;
  function ringGauge(left) {
    const c = 2 * Math.PI * 62;
    return `<svg viewBox="0 0 150 150" aria-hidden="true"><circle cx="75" cy="75" r="62" fill="none" stroke="rgba(148,163,184,.2)" stroke-width="12"/>
      <circle cx="75" cy="75" r="62" fill="none" stroke="${left <= 20 ? "#ef4444" : "rgb(var(--a2))"}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c * (1 - left / 100)).toFixed(1)}" transform="rotate(-90 75 75)"/></svg>`;
  }
  const PANELS = {
    worlds() {
      const ac = window.CBPILOT_THEME?.accent || "original";
      return `<div class="pl-ph"><div><span class="eyebrow">CB Pilot</span><h2 id="pl-panel-title">${T("Explorar mundos", "Explore worlds")}</h2><p>${T("Elija el ambiente de su cabina. Todos están incluidos en todos los planes.", "Pick your cockpit's ambience. All of them are included in every plan.")}</p></div>${closeX}</div>
        <div class="pl-worlds">${WORLDS.map(([k, es, en, des, den]) => `<button type="button" class="pl-world" data-world="${k}" aria-pressed="${ac === k}"><span class="wp wp-${k}">${ac === k ? `<span class="tag">${T("Activo", "Active")}</span>` : ""}<img src="/assets/img/pilo.svg" alt=""></span><span class="wb"><b>${esc(T(es, en))}</b><small>${esc(T(des, den))}</small></span></button>`).join("")}</div>
        <p class="muted">${T("Por ahora cada mundo cambia la paleta y la iluminación. Los paisajes animados (selva, volcán, playa…) llegan en las próximas fases, empezando por la Selva.", "For now each world changes the palette and lighting. Animated landscapes (rainforest, volcano, beach…) arrive in the next phases, starting with the Rainforest.")}</p>`;
    },
    cabina() {
      const pct = info?.perDay ? Math.min(100, Math.round(info.usedToday / info.perDay * 100)) : null;
      const mpct = info?.perMonth ? Math.min(100, Math.round(info.usedMonth / info.perMonth * 100)) : null;
      const mode = (k, cls, icon, es, en, des, den, attr, on) => `<button type="button" class="pl-mode ${cls}" ${attr}="${on}" data-set="${k}"><span class="mi" aria-hidden="true">${icon}</span><b>${esc(T(es, en))}</b><small>${esc(T(des, den))}</small>${on ? `<span class="st">${T("Activo", "On")}</span>` : ""}</button>`;
      return `<div class="pl-ph"><div><span class="eyebrow">${T("Copiloto", "Copilot")}</span><h2 id="pl-panel-title">${T("Cabina de mando", "Cockpit")}</h2><p>${T("Su plan, su uso real y cómo quiere que se comporte CB Pilot.", "Your plan, your real usage and how you want CB Pilot to behave.")}</p></div>${closeX}</div>
        <div class="pl-cab">
          <div class="pl-ring">${pct === null ? `<p class="muted">${esc(offline || T("Sin conexión con el servidor: no hay datos de uso.", "No server connection: no usage data."))}</p>` : `${ringGauge(100 - pct)}<span class="rv">${100 - pct} %</span><small>${T("Combustible de hoy: uso que le queda del plan", "Today's fuel: plan usage left")}</small>`}
            ${info ? `<span class="pl-badge ${esc(info.plan)}">${T("Plan", "Plan")} ${esc(planName(info.plan))}</span>` : ""}</div>
          <div class="pl-sec"><h3>${T("Modo de vuelo", "Flight mode")}</h3>
            <div class="pl-modes">
              ${mode("style:rapido", "m-crucero", "✈️", "Crucero", "Cruise", "Respuestas directas y al grano. Ideal para el día a día.", "Direct, to-the-point answers. Great for everyday use.", "aria-pressed", settings.style === "rapido")}
              ${mode("style:detallado", "m-turbo", "🚀", "Turbo", "Turbo", "Respuestas más completas y razonamiento más profundo. Puede tardar un poco más.", "More complete answers and deeper reasoning. May take a bit longer.", "aria-pressed", settings.style === "detallado")}
              ${mode("ahorro:toggle", "m-ahorro", "🌱", "Ahorro", "Saver", "Menos animaciones y efectos para cuidar la batería del dispositivo. Se combina con Crucero o Turbo.", "Fewer animations and effects to save battery. Works with Cruise or Turbo.", "aria-checked", ahorroOn())}
            </div>
            <div class="pl-stats">
              <div class="pl-stat"><small>${T("Modelo de su plan", "Your plan's model")}</small><b>${esc(info?.label || "—")}</b></div>
              <div class="pl-stat"><small>${T("Tareas a la vez", "Tasks at once")}</small><b>${info?.parallel ?? "—"}</b></div>
              <div class="pl-stat"><small>${T("Uso del mes", "Monthly usage")}</small><b>${mpct === null ? T("Sin límite mensual", "No monthly limit") : mpct + " %"}</b></div>
            </div>
            <button type="button" class="btn btn-primary btn-sm" data-act="plans">${info?.plan === "gratis" ? T("✦ Mejorar plan", "✦ Upgrade plan") : T("Ver planes", "View plans")}</button>
          </div></div>`;
    },
    settings() {
      const th = window.CBPILOT_THEME?.theme || "dark";
      return `<div class="pl-ph"><div><span class="eyebrow">CB Pilot</span><h2 id="pl-panel-title">${T("Configuración", "Settings")}</h2><p>${T("Se guarda en este dispositivo.", "Saved on this device.")}</p></div>${closeX}</div>
        <div class="pl-sec"><h3>${T("Apariencia", "Appearance")}</h3>${seg3("theme", th, [["dark", T("🌙 Oscuro", "🌙 Dark")], ["light", T("☀️ Claro", "☀️ Light")], ["system", T("💻 Sistema", "💻 System")]])}
          <div class="pl-row"><p>${T("Mundo actual", "Current world")}: <b>${esc(T(...(WORLDS.find(w => w[0] === (window.CBPILOT_THEME?.accent || "original")) || WORLDS[0]).slice(1, 3)))}</b></p><button type="button" class="btn btn-ghost btn-sm" data-open="worlds">${T("Explorar mundos", "Explore worlds")}</button></div></div>
        <div class="pl-sec"><h3>${T("Cómo habla Pilo", "How Pilo talks")}</h3>${seg3("habla", settings.habla, [["tico", "🇨🇷 Tico"], ["neutro", T("🌎 Neutro", "🌎 Neutral")], ["formal", "👔 Formal"]])}
          <p class="muted">${T("En documentos legales, cartas o textos profesionales siempre usa un tono formal.", "Legal documents, letters and professional texts always use a formal tone.")}</p></div>
        <div class="pl-sec"><div class="pl-row"><div><h3>${T("Modo Ahorro", "Saver mode")}</h3><p>${T("Menos animaciones y efectos. Recomendado en celulares con poca batería.", "Fewer animations and effects. Recommended on phones with low battery.")}</p></div><button type="button" class="pl-switchbtn" role="switch" aria-checked="${ahorroOn()}" data-set="ahorro:toggle" aria-label="${T("Modo Ahorro", "Saver mode")}"></button></div></div>
        <div class="pl-sec"><h3>${T("Idioma de la interfaz", "Interface language")}</h3>${seg3("lang", A.lang, [["es", "Español"], ["en", "English"]])}</div>
        <div class="pl-sec"><h3>${T("Datos", "Data")}</h3><div class="pl-row"><p>${T("Sus chats y tareas se guardan en este dispositivo.", "Your chats and tasks are stored on this device.")}</p><button type="button" class="btn btn-ghost btn-sm pl-danger" data-act="wipe">${T("Borrar historial", "Delete history")}</button></div>
          <div class="pl-row"><p>${user ? esc(user.email) : T("Sin sesión iniciada", "Not signed in")}</p><button type="button" class="btn btn-ghost btn-sm" data-act="${user ? "account" : "auth"}">${user ? T("Mi cuenta", "My account") : T("Iniciar sesión", "Sign in")}</button></div></div>`;
    },
    welcome() {
      const st = (k, icon, es, en, sample) => `<button type="button" class="pl-style" data-set="habla:${k}" aria-pressed="${settings.habla === k}"><b>${icon} ${esc(T(es, en))}</b><em>${esc(sample)}</em></button>`;
      return `<div class="pl-welcome-pilo">${pilo("pilo-hero")}</div>
        <div class="pl-ph" style="justify-content:center;text-align:center;padding:0"><div><h2 id="pl-panel-title">${T("¡Pura vida! Soy Pilo", "Pura vida! I'm Pilo")}</h2><p>${T("Su copiloto de IA. Antes de despegar: ¿cómo prefiere que le hable?", "Your AI copilot. Before takeoff: how would you like me to talk?")}</p></div></div>
        <div class="pl-styles">${st("tico", "🇨🇷", "Tico amigable", "Friendly Tico", T("«¡Pura vida! Con mucho gusto le ayudo con eso.»", "“Pura vida! Happy to help you with that.”"))}${st("neutro", "🌎", "Español neutro", "Neutral Spanish", T("«¡Hola! Con gusto te ayudo con eso.»", "“Hi! I'm glad to help you with that.”"))}${st("formal", "👔", "Formal", "Formal", T("«Buenos días. Será un placer asistirle.»", "“Good morning. It will be a pleasure to assist you.”"))}</div>
        <p class="muted" style="text-align:center">${T("Puede cambiarlo cuando quiera en Configuración.", "You can change it anytime in Settings.")}</p>
        <button type="button" class="btn btn-primary" data-act="welcome-done">${T("✈️ Despegar", "✈️ Take off")}</button>`;
    }
  };
  function openPanel(kind) {
    panelKind = kind; $("#pl-panel-body").innerHTML = PANELS[kind]();
    if (!panel.open) panel.showModal();
  }
  const refreshPanel = () => { if (panel.open && panelKind) $("#pl-panel-body").innerHTML = PANELS[panelKind](); };
  panel.addEventListener("cancel", e => { if (panelKind === "welcome") { e.preventDefault(); } });
  panel.addEventListener("click", async e => {
    if (panelKind !== "welcome" && (e.target === panel || e.target.closest("[data-close]"))) return panel.close();
    const w = e.target.closest("[data-world]");
    if (w) { window.CBPILOT_THEME?.set("accent", w.dataset.world); return refreshPanel(); }
    const o = e.target.closest("[data-open]"); if (o) return openPanel(o.dataset.open);
    const st = e.target.closest("[data-set]");
    if (st) {
      const [k, v] = st.dataset.set.split(":");
      if (k === "theme") window.CBPILOT_THEME?.set("theme", v);
      if (k === "habla") { settings.habla = v; write("cbpilot-habla", v); }
      if (k === "style") { settings.style = v; write("cbpilot-style", v); syncPickers(); }
      if (k === "ahorro") window.CBPILOT_THEME?.set("ahorro", ahorroOn() ? "0" : "1");
      if (k === "lang") A.setLang(v);
      return refreshPanel();
    }
    const a = e.target.closest("[data-act]"); if (!a) return;
    const act = a.dataset.act;
    if (act === "welcome-done") { write("cbpilot-welcomed", 1); panel.close(); $("#pl-input").focus(); if (info?.requireAccount && !user) openAuth("register", true); }
    if (act === "plans") { panel.close(); openPlans(); }
    if (act === "account") { panel.close(); openAccount(); }
    if (act === "auth") { panel.close(); openAuth("login"); }
    if (act === "wipe" && confirm(T("¿Borrar todos los chats y tareas de este dispositivo? No se puede deshacer.", "Delete all chats and tasks on this device? This can't be undone."))) {
      running.forEach(c => c.abort()); chats = []; tasks = []; current = null; saveChats(); saveTasks(); renderList(); renderThread(); paintTasks(); panel.close();
      note(T("Listo: el historial de este dispositivo se borró.", "Done: this device's history was deleted."), true);
    }
  });
  $$("[data-open]").forEach(b => b.addEventListener("click", () => { closeSide(); openPanel(b.dataset.open); }));
  $("#pl-theme-btn").addEventListener("click", () => openPanel("worlds"));
  $("#pl-dark-btn").addEventListener("click", () => { const d = document.documentElement.dataset.theme === "light"; window.CBPILOT_THEME?.set("theme", d ? "dark" : "light"); });

  // ---------------- Cuenta del cliente ----------------
  const initials = n => (n || "?").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
  function renderAcct() {
    const box = $("#pl-acct");
    if (!info) { box.innerHTML = ""; return; }
    box.innerHTML = user
      ? `<button type="button" class="pl-me" id="pl-me" aria-haspopup="menu" aria-expanded="false"><span class="pl-avatar" aria-hidden="true">${esc(initials(user.name))}</span><span class="pl-me-txt"><b>${esc(user.name)}</b><small>${esc(user.email)}</small></span><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg></button>`
      : `<button type="button" class="btn btn-primary btn-sm pl-login" data-auth="login">${T("Iniciar sesión", "Sign in")}</button><button type="button" class="pl-link pl-signup" data-auth="register">${T("o crear una cuenta gratis", "or create a free account")}</button>`;
  }
  $("#pl-acct").addEventListener("click", e => {
    const a = e.target.closest("[data-auth]"); if (a) return openAuth(a.dataset.auth);
    const me = e.target.closest("#pl-me"); if (!me) return;
    openMenu(me, `<p class="pl-mh">${esc(user.email)}</p>${item("account", ["👤", "Mi cuenta", "My account", "Perfil, plan y contraseña", "Profile, plan and password"], false)}${item("plans", ["✦", "Planes", "Plans", "Mejorar o activar un código", "Upgrade or activate a code"], false)}${item("logout", ["↩", "Cerrar sesión", "Sign out", "En este dispositivo", "On this device"], false)}`, async v => {
      closeMenu();
      if (v === "account") openAccount(); else if (v === "plans") openPlans(); else await logout();
    });
  });
  async function logout() {
    await post("/api/account/logout", {}).catch(() => {});
    user = null; await refreshStatus(); renderThread();
    $("#pl-live").textContent = T("Cerraste sesión.", "Signed out.");
  }

  // Iniciar sesión / crear cuenta. "forced" = el dueño pide cuenta para usar CB Pilot (no se puede cerrar).
  let authForced = false;
  function openAuth(mode = "login", forced = false) {
    authForced = forced;
    const reg = mode === "register", dlg = $("#pl-auth");
    $("#pl-auth-body").innerHTML = `<div class="pl-auth-head"><img class="pl-auth-orb" src="/assets/img/pilo.svg" alt="" width="64" height="64">
        <h2 id="pl-auth-title">${reg ? T("Creá tu cuenta", "Create your account") : T("Bienvenido de vuelta", "Welcome back")}</h2>
        <p class="muted">${forced ? T("Para usar CB Pilot necesitás una cuenta. Es gratis.", "You need an account to use CB Pilot. It's free.") : reg ? T("Gratis. Tu plan y tu uso te siguen en todos tus dispositivos.", "Free. Your plan and usage follow you on every device.") : T("Entrá para usar tu plan en este dispositivo.", "Sign in to use your plan on this device.")}</p>
        ${forced ? "" : `<button type="button" class="pl-icon pl-auth-x" data-close aria-label="${T("Cerrar", "Close")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button>`}</div>
      <div class="pl-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!reg}" data-tab="login">${T("Iniciar sesión", "Sign in")}</button><button type="button" role="tab" aria-selected="${reg}" data-tab="register">${T("Crear cuenta", "Create account")}</button></div>
      <form id="pl-auth-form" class="pl-auth-form" novalidate>
        ${reg ? `<div class="field"><label for="au-name">${T("Nombre", "Name")}</label><input id="au-name" autocomplete="name" required maxlength="80"></div>` : ""}
        <div class="field"><label for="au-email">${T("Correo", "Email")}</label><input id="au-email" type="email" autocomplete="email" required></div>
        <div class="field"><label for="au-pw">${T("Contraseña", "Password")}${reg ? ` <small class="muted">${T("(mínimo 8 caracteres)", "(at least 8 characters)")}</small>` : ""}</label>
          <div class="pl-pw"><input id="au-pw" type="password" autocomplete="${reg ? "new-password" : "current-password"}" required minlength="${reg ? 8 : 1}"><button type="button" class="pl-pw-eye" data-eye aria-label="${T("Mostrar contraseña", "Show password")}">👁</button></div></div>
        <div id="au-msg"></div>
        <button class="btn btn-primary" type="submit">${reg ? T("Crear cuenta", "Create account") : T("Entrar", "Sign in")}</button>
        ${reg ? `<p class="muted pl-auth-legal">${T("Al crear tu cuenta aceptás los <a href='/terminos/' target='_blank'>términos</a> y la <a href='/privacidad/' target='_blank'>privacidad</a>.", "By creating an account you accept the <a href='/terminos/' target='_blank'>terms</a> and <a href='/privacidad/' target='_blank'>privacy policy</a>.")}</p>` : `<p class="muted pl-auth-legal">${T("¿Olvidaste tu contraseña? Escribinos por", "Forgot your password? Message us on")} <a href="https://wa.me/${esc(info?.whatsapp || "")}" target="_blank" rel="noopener noreferrer">WhatsApp</a>.</p>`}
      </form>`;
    dlg.dataset.mode = mode;
    if (!dlg.open) dlg.showModal();
    $(reg ? "#au-name" : "#au-email").focus();
  }
  $("#pl-auth").addEventListener("cancel", e => { if (authForced) e.preventDefault(); });
  $("#pl-auth").addEventListener("click", e => {
    const dlg = e.currentTarget;
    if (!authForced && (e.target === dlg || e.target.closest("[data-close]"))) return dlg.close();
    const tab = e.target.closest("[data-tab]"); if (tab) return openAuth(tab.dataset.tab, authForced);
    const eye = e.target.closest("[data-eye]"); if (eye) { const i = $("#au-pw"); i.type = i.type === "password" ? "text" : "password"; }
  });
  $("#pl-auth").addEventListener("submit", async e => {
    e.preventDefault();
    const reg = e.currentTarget.dataset.mode === "register", btn = e.target.querySelector("[type=submit]"), box = $("#au-msg");
    const body = { email: $("#au-email").value, password: $("#au-pw").value };
    if (reg) body.name = $("#au-name").value;
    btn.disabled = true;
    try {
      const r = await post(reg ? "/api/account/register" : "/api/account/login", body);
      user = r.user; authForced = false; $("#pl-auth").close();
      await refreshStatus(); renderThread();
      note(reg ? T(`¡Bienvenido, ${firstName()}! Tu cuenta está lista.`, `Welcome, ${firstName()}! Your account is ready.`) : T(`¡Hola de nuevo, ${firstName()}!`, `Welcome back, ${firstName()}!`), true);
    } catch (err) { box.innerHTML = `<p class="form-msg" role="alert">${esc(err.message)}</p>`; btn.disabled = false; }
  });

  // Mi cuenta: perfil, plan, contraseña y eliminar la cuenta.
  function openAccount() {
    if (!user) return openAuth("login");
    const pct = info?.perDay ? Math.min(100, Math.round(info.usedToday / info.perDay * 100)) : 0;
    const exp = info?.plan !== "gratis" && info?.expiresAt ? new Date(info.expiresAt).toLocaleDateString(A.lang === "en" ? "en-US" : "es-CR", { dateStyle: "long" }) : "";
    $("#pl-account-body").innerHTML = `<div class="pl-acc-head"><span class="pl-avatar pl-avatar-lg" aria-hidden="true">${esc(initials(user.name))}</span><div><h2 id="pl-account-title">${esc(user.name)}</h2><p class="muted">${esc(user.email)}</p></div>
        <button type="button" class="pl-icon pl-auth-x" data-close aria-label="${T("Cerrar", "Close")}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></div>
      <section class="pl-acc-card"><div class="pl-plan-row"><span class="pl-badge ${esc(info?.plan || "gratis")}">${T("Plan", "Plan")} ${esc(planName(info?.plan || "gratis"))}</span><button type="button" class="btn btn-ghost btn-sm" data-act="plans">${info?.plan === "gratis" ? T("✦ Mejorar plan", "✦ Upgrade") : T("Ver planes", "View plans")}</button></div>
        ${exp ? `<p class="muted">${T("Activo hasta el", "Active until")} ${esc(exp)}</p>` : ""}
        ${fuelGauge(100 - pct)}
        <p class="muted">${T(`Miembro desde ${new Date(user.createdAt).toLocaleDateString("es-CR", { month: "long", year: "numeric" })}.`, `Member since ${new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`)}</p></section>
      <form class="pl-acc-card" id="acc-profile"><h3>${T("Perfil", "Profile")}</h3><div class="field"><label for="acc-name">${T("Nombre", "Name")}</label><input id="acc-name" value="${esc(user.name)}" maxlength="80" required></div><div class="acc-msg"></div><button class="btn btn-primary btn-sm" type="submit">${T("Guardar", "Save")}</button></form>
      <form class="pl-acc-card" id="acc-password"><h3>${T("Contraseña", "Password")}</h3><div class="fields"><div class="field"><label for="acc-cur">${T("Actual", "Current")}</label><input id="acc-cur" type="password" autocomplete="current-password" required></div><div class="field"><label for="acc-new">${T("Nueva (mínimo 8)", "New (min. 8)")}</label><input id="acc-new" type="password" autocomplete="new-password" minlength="8" required></div></div>
        <p class="muted">${T("Al cambiarla se cierra la sesión en tus otros dispositivos.", "Changing it signs you out on your other devices.")}</p><div class="acc-msg"></div><button class="btn btn-primary btn-sm" type="submit">${T("Cambiar contraseña", "Change password")}</button></form>
      <section class="pl-acc-card"><h3>${T("Privacidad", "Privacy")}</h3><p class="muted">${T("Tus chats se guardan solo en este dispositivo. Tu cuenta guarda tu nombre, correo, plan y uso.", "Your chats are stored only on this device. Your account stores your name, email, plan and usage.")}</p>
        <div class="pl-acc-row"><button type="button" class="btn btn-ghost btn-sm" data-act="logout">${T("Cerrar sesión", "Sign out")}</button><button type="button" class="btn btn-ghost btn-sm pl-danger" data-act="delete">${T("Eliminar mi cuenta", "Delete my account")}</button></div>
        <form id="acc-delete" hidden><div class="field"><label for="acc-del">${T("Para confirmar, escribí tu contraseña", "To confirm, enter your password")}</label><input id="acc-del" type="password" autocomplete="current-password" required></div><div class="acc-msg"></div><button class="btn btn-primary btn-sm pl-danger-btn" type="submit">${T("Eliminar definitivamente", "Delete permanently")}</button></form></section>`;
    const dlg = $("#pl-account"); if (!dlg.open) dlg.showModal();
  }
  const accMsg = (form, text, ok) => { form.querySelector(".acc-msg").innerHTML = `<p class="form-msg${ok ? " ok" : ""}" role="status">${esc(text)}</p>`; };
  $("#pl-account").addEventListener("click", async e => {
    const dlg = e.currentTarget;
    if (e.target === dlg || e.target.closest("[data-close]")) return dlg.close();
    const b = e.target.closest("[data-act]"); if (!b) return;
    if (b.dataset.act === "plans") { dlg.close(); openPlans(); }
    if (b.dataset.act === "logout") { dlg.close(); await logout(); }
    if (b.dataset.act === "delete") { const f = $("#acc-delete"); f.hidden = !f.hidden; if (!f.hidden) $("#acc-del").focus(); }
  });
  $("#pl-account").addEventListener("submit", async e => {
    e.preventDefault(); const f = e.target, btn = f.querySelector("[type=submit]"); btn.disabled = true;
    try {
      if (f.id === "acc-profile") { const r = await post("/api/account/profile", { name: $("#acc-name").value }); user = r.user; renderAcct(); renderThread(); openAccount(); accMsg($("#acc-profile"), T("Guardado.", "Saved."), true); return; }
      if (f.id === "acc-password") { await post("/api/account/password", { current: $("#acc-cur").value, next: $("#acc-new").value }); f.reset(); accMsg(f, T("Contraseña cambiada.", "Password changed."), true); }
      if (f.id === "acc-delete") { await post("/api/account/delete", { password: $("#acc-del").value }); $("#pl-account").close(); user = null; await refreshStatus(); renderThread(); note(T("Tu cuenta fue eliminada.", "Your account was deleted."), true); return; }
    } catch (err) { accMsg(f, err.message); }
    btn.disabled = false;
  });

  // ---------------- Eventos ----------------
  $("#pl-form").addEventListener("submit", e => { e.preventDefault(); if (running.has(current)) running.get(current).abort(); else send($("#pl-input").value); });
  $("#pl-input").addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey && !e.isComposing && matchMedia("(pointer:fine)").matches) { e.preventDefault(); $("#pl-form").requestSubmit(); } });
  $("#pl-input").addEventListener("input", grow);
  $("#pl-new").addEventListener("click", () => { const c = chatById(current); if (!c || c.messages.length) newChat(); settings.assistant = "general"; syncPickers(); setView("chat"); closeSide(); $("#pl-input").focus(); });
  $("#pl-search").addEventListener("input", e => { query = e.target.value.trim(); renderList(); });
  $$(".pl-nav [data-view]").forEach(b => b.addEventListener("click", () => { setView(b.dataset.view); closeSide(); }));
  $("#pl-side-open").addEventListener("click", openSide);
  $("#pl-side-close").addEventListener("click", closeSide);
  scrim.addEventListener("click", closeSide);
  $("#pl-plans-open").addEventListener("click", openPlans);
  $("#pl-plan").addEventListener("click", e => { if (e.target.closest("[data-act=plans]")) openPlans(); });
  $("#pl-canvas-close").addEventListener("click", closePreview);
  $$(".pl-seg [data-size]").forEach(b => b.addEventListener("click", () => { $$(".pl-seg [data-size]").forEach(x => x.setAttribute("aria-pressed", String(x === b))); $("#pl-canvas").classList.toggle("is-mobile", b.dataset.size === "mobile"); }));
  $("#pl-canvas-dl").addEventListener("click", () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([canvasHtml], { type: "text/html" })); a.download = "cb-pilot-diseno.html"; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); });
  document.addEventListener("keydown", e => { if (e.key === "Escape") { if (side.classList.contains("is-open")) closeSide(); else if (!$("#pl-canvas").hidden && !$("#pl-plans").open) closePreview(); } });

  async function copy(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch { const t = document.createElement("textarea"); t.value = text; document.body.append(t); t.select(); try { document.execCommand("copy"); } catch {} t.remove(); }
    const s = btn.querySelector("span") || btn, old = s.textContent; s.textContent = T("¡Copiado!", "Copied!"); setTimeout(() => { s.textContent = old; }, 1500);
  }

  $("#pl-list").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return; e.preventDefault();
    const id = b.closest("[data-id]").dataset.id, c = chatById(id); if (!c) return;
    if (b.dataset.act === "open") openChat(id);
    else if (b.dataset.act === "pin") { c.pinned = !c.pinned; saveChats(); renderList(); }
    else if (b.dataset.act === "rename") { const t = prompt(T("Nuevo nombre del chat", "New chat name"), c.title); if (t && t.trim()) { c.title = titleFrom(t); saveChats(); renderList(); if (id === current) renderThread(); } }
    else if (b.dataset.act === "delete" && confirm(T("¿Eliminar este chat? No se puede deshacer.", "Delete this chat? This can't be undone."))) {
      running.get(id)?.abort(); chats = chats.filter(x => x.id !== id); if (current === id) current = null; saveChats(); renderList(); renderThread();
    }
  });

  $("#pl-thread").addEventListener("click", e => {
    const chip = e.target.closest("[data-chip]");
    if (chip) { const c = CHIPS[+chip.dataset.chip]; return send(T(c[5], c[6])); }
    const b = e.target.closest("[data-act]"); if (!b) return;
    const chat = chatById(current), msgEl = b.closest("[data-i]"), m = chat && msgEl ? chat.messages[+msgEl.dataset.i] : null;
    switch (b.dataset.act) {
      case "copy-code": return copy(b.closest(".pl-code").querySelector("code").textContent, b);
      case "preview": return openPreview(b.closest(".pl-code").querySelector("code").textContent);
      case "preview-last": return openPreview(lastHtml(m.content));
      case "copy": return copy(m.content, b);
      case "plans": return openPlans();
      case "rate": m.rating = m.rating === b.dataset.v ? null : b.dataset.v; saveChats(); return renderThread();
      case "regen":
        if (running.has(chat.id)) return;
        if (activeCount() >= limit()) return note(T(`Tu plan permite ${limit()} respuestas a la vez.`, `Your plan allows ${limit()} responses at once.`));
        if (chat.messages[chat.messages.length - 1].role === "assistant") chat.messages.pop();
        return runChat(chat);
      case "continue": return send(T("Continuá", "Continue"));
      case "edit": {
        if (running.has(chat.id)) return;
        let k = chat.messages.length - 1; while (k >= 0 && chat.messages[k].role !== "user") k--;
        const text = chat.messages[k].content; chat.messages.splice(k);
        saveChats(); renderThread(); const t = $("#pl-input"); t.value = text; grow(); t.focus();
      }
    }
  });

  $("#pl-plans").addEventListener("click", async e => {
    if (e.target === e.currentTarget || e.target.closest("[data-close]")) return e.currentTarget.close();
    if (e.target.closest("[data-act=logout]")) { pass = null; write(K.pass, null); await refreshStatus(); openPlans(); }
    if (e.target.closest("[data-act=auth]")) { e.currentTarget.close(); openAuth("register"); }
  });
  $("#pl-plans").addEventListener("submit", async e => {
    if (e.target.id !== "pl-activate") return; e.preventDefault();
    const box = $("#pl-act-msg"), btn = e.target.querySelector("button"); btn.disabled = true;
    try {
      const r = await post("/api/pilot/activate", { code: $("#pl-code").value });
      if (r.pass) { pass = r.pass; write(K.pass, pass); } // sin cuenta: el plan queda en este dispositivo
      await refreshStatus(); openPlans();
      $("#pl-act-msg").innerHTML = `<p class="form-msg ok" role="status">${T("¡Listo! Tu plan", "Done! Your")} ${esc(info?.planName || r.plan)} ${T("ya está activo.", "plan is active.")}</p>`;
    } catch (err) { box.innerHTML = `<p class="form-msg" role="alert">${esc(err.message)}</p>`; btn.disabled = false; }
  });

  $("#pl-packs").addEventListener("click", e => { const b = e.target.closest("[data-pack]"); if (!b) return; const t = $("#pl-task-input"); t.value = (t.value.trim() ? t.value.trim() + "\n" : "") + PACKS[+b.dataset.pack][1].join("\n"); t.focus(); });
  $("#pl-task-form").addEventListener("submit", e => { e.preventDefault(); launch($("#pl-task-input").value); });
  $("#pl-task-clear").addEventListener("click", () => { tasks = tasks.filter(t => t.status === "running" || t.status === "queued"); saveTasks(); paintTasks(); });
  $("#pl-board").addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const card = b.closest("[data-id]"), t = tasks.find(x => x.id === card.dataset.id); if (!t) return;
    switch (b.dataset.act) {
      case "t-toggle": card.classList.toggle("is-open"); b.querySelector("span").textContent = card.classList.contains("is-open") ? T("Ver menos", "Less") : T("Ver todo", "Expand"); break;
      case "t-copy": copy(t.content, b); break;
      case "t-preview": openPreview(lastHtml(t.content)); break;
      case "t-cancel": if (running.has(t.id)) running.get(t.id).abort(); else { tasks = tasks.filter(x => x !== t); saveTasks(); paintTasks(); } break;
      case "t-delete": tasks = tasks.filter(x => x !== t); saveTasks(); paintTasks(); break;
      case "t-retry": t.status = "queued"; delete t.error; saveTasks(); paintTasks(); pump(); break;
      case "t-chat": {
        const c = { id: uid(), title: titleFrom(t.prompt), created: Date.now(), updated: Date.now(), pinned: false, messages: [{ role: "user", content: t.prompt }, { role: "assistant", content: t.content }] };
        chats.unshift(c); saveChats(); openChat(c.id);
      }
    }
  });

  A.onLang(() => { renderQuick(); refreshPanel(); syncPickers(); renderAcct(); renderAtts(); renderList(); renderPlan(); renderPacks(); if (view === "tasks") { $("#pl-title").textContent = T("Torre de control", "Control tower"); paintTasks(); } else renderThread(); syncComposer(); });

  // ---------------- Inicio ----------------
  // Despegue: la animación de bienvenida se ve una vez por sesión del navegador.
  try { if (sessionStorage.getItem("cbpilot-despegue")) $("#pl-splash")?.remove(); else { sessionStorage.setItem("cbpilot-despegue", "1"); setTimeout(() => $("#pl-splash")?.remove(), 2000); } } catch { $("#pl-splash")?.remove(); }
  const q = new URLSearchParams(location.search).get("q");
  if (q) { $("#pl-input").value = q.slice(0, 2000); grow(); }
  if (current && !chatById(current)) current = null;
  settings.assistant = chatById(current)?.assistant || "general";
  syncPickers(); renderQuick(); renderPacks(); renderList(); renderPlan();
  setView(location.hash === "#tareas" ? "tasks" : "chat");
  renderThread(true);
  refreshStatus().then(() => { pump(); if (!read("cbpilot-welcomed", 0) && !$("#pl-auth").open) openPanel("welcome"); });
})();
