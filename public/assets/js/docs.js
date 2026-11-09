/* CB Pilot — Archivos descargables: Word (.docx), PDF, Excel (.xlsx) y PowerPoint (.pptx).
   Todo se arma en el navegador del usuario a partir del bloque ```cbdoc que entrega Pilo:
   no gasta IA extra ni pasa por el servidor. Las librerías se cargan solo la primera vez que se descarga algo. */
(() => {
  const loaded = new Map();
  const load = src => {
    if (!loaded.has(src)) loaded.set(src, new Promise((ok, bad) => {
      const s = document.createElement("script"); s.src = src; s.async = true;
      s.onload = ok; s.onerror = () => { loaded.delete(src); bad(new Error("No se pudo cargar " + src)); };
      document.head.append(s);
    }));
    return loaded.get(src);
  };
  const fileName = (name, ext) => (String(name || "documento").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "documento") + "." + ext;
  function save(blob, name) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const BLUE = "2563EB", NAVY = "101D38", DARK = "070D1C";

  // ---------------- Word ----------------
  // Markdown sencillo → docx: títulos, párrafos, listas, tablas, citas, **negrita**, *cursiva* y `código`.
  function runs(D, text, base = {}) {
    const out = [], re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`)/g; let last = 0, m;
    const push = (t, o = {}) => t && out.push(new D.TextRun({ text: t, ...base, ...o }));
    while ((m = re.exec(text))) {
      push(text.slice(last, m.index));
      const t = m[0];
      if (t.startsWith("**")) push(t.slice(2, -2), { bold: true });
      else if (t.startsWith("`")) push(t.slice(1, -1), { font: "Consolas" });
      else push(t.slice(1, -1), { italics: true });
      last = re.lastIndex;
    }
    push(text.slice(last));
    return out.length ? out : [new D.TextRun({ text: "", ...base })];
  }
  const cells = line => line.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  function mdToDocx(D, md) {
    const lines = String(md || "").replace(/\r/g, "").split("\n"), out = [];
    let para = [];
    const flush = () => { if (para.length) { out.push(new D.Paragraph({ children: runs(D, para.join(" ")), spacing: { after: 160 } })); para = []; } };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i], t = l.trim();
      if (!t) { flush(); continue; }
      let m;
      if ((m = t.match(/^(#{1,3})\s+(.*)/))) { flush(); out.push(new D.Paragraph({ heading: [D.HeadingLevel.HEADING_1, D.HeadingLevel.HEADING_2, D.HeadingLevel.HEADING_3][m[1].length - 1], children: runs(D, m[2].replace(/\*\*/g, "")) })); continue; }
      if (/^(-{3,}|\*{3,})$/.test(t)) { flush(); continue; }
      if ((m = l.match(/^(\s*)[-*•]\s+(.*)/))) { flush(); out.push(new D.Paragraph({ children: runs(D, m[2]), bullet: { level: Math.min(2, Math.floor(m[1].length / 2)) } })); continue; }
      if ((m = l.match(/^(\s*)\d+[.)]\s+(.*)/))) { flush(); out.push(new D.Paragraph({ children: runs(D, m[2]), numbering: { reference: "num", level: Math.min(2, Math.floor(m[1].length / 2)) } })); continue; }
      if (t.startsWith(">")) { flush(); out.push(new D.Paragraph({ children: runs(D, t.replace(/^>\s?/, ""), { italics: true, color: "475569" }), indent: { left: 400 } })); continue; }
      if (t.startsWith("|")) {
        flush();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith("|")) { if (!/^\|?[\s:|-]+\|?$/.test(lines[i].trim())) rows.push(cells(lines[i])); i++; }
        i--;
        const n = Math.max(...rows.map(r => r.length));
        out.push(new D.Table({
          width: { size: 100, type: D.WidthType.PERCENTAGE },
          rows: rows.map((r, ri) => new D.TableRow({ tableHeader: ri === 0, children: Array.from({ length: n }, (_, ci) => new D.TableCell({
            shading: ri === 0 ? { fill: "E8EEFB", type: D.ShadingType.CLEAR, color: "auto" } : undefined,
            children: [new D.Paragraph({ children: runs(D, r[ci] || "", ri === 0 ? { bold: true } : {}) })]
          })) }))
        }));
        out.push(new D.Paragraph({ children: [] }));
        continue;
      }
      para.push(t);
    }
    flush();
    return out;
  }
  async function word(doc) {
    await load("/assets/vendor/docx.min.js");
    const D = window.docx;
    const file = new D.Document({
      creator: "CB Pilot", title: doc.nombre || "Documento",
      styles: { default: { document: { run: { font: "Calibri", size: 22 } } },
        paragraphStyles: [{ id: "Title", name: "Title", basedOn: "Normal", run: { size: 44, bold: true, color: NAVY }, paragraph: { spacing: { after: 240 } } }] },
      numbering: { config: [{ reference: "num", levels: [0, 1, 2].map(level => ({ level, format: D.LevelFormat.DECIMAL, text: `%${level + 1}.`, alignment: D.AlignmentType.START, style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } } })) }] },
      sections: [{
        footers: { default: new D.Footer({ children: [new D.Paragraph({ alignment: D.AlignmentType.CENTER, children: [new D.TextRun({ text: "Creado con CB Pilot · CeBe Studio", size: 16, color: "94A3B8" })] })] }) },
        children: [...(doc.nombre ? [new D.Paragraph({ style: "Title", children: [new D.TextRun(doc.nombre)] })] : []), ...mdToDocx(D, doc.contenido)]
      }]
    });
    save(await D.Packer.toBlob(file), fileName(doc.nombre, "docx"));
  }

  // ---------------- PDF ----------------
  // Se abre el diálogo de impresión con un diseño limpio: el usuario elige «Guardar como PDF».
  function pdf(doc, html) {
    const f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.append(f);
    const w = f.contentWindow, d = w.document;
    d.open();
    d.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${(doc.nombre || "Documento").replace(/[<>&"]/g, "")}</title><style>
      @page{margin:18mm 16mm}
      body{font:11pt/1.55 Calibri,"Segoe UI",Arial,sans-serif;color:#1e293b;margin:0}
      h1.doc-t{font-size:22pt;color:#${NAVY};margin:0 0 4mm;padding-bottom:3mm;border-bottom:2pt solid #${BLUE}}
      h1,h2,h3{color:#${NAVY};page-break-after:avoid;line-height:1.25}h1{font-size:17pt}h2{font-size:14pt;margin-top:6mm}h3{font-size:12pt}
      table{border-collapse:collapse;width:100%;margin:3mm 0;page-break-inside:avoid}th,td{border:1px solid #cbd5e1;padding:4px 7px;text-align:left;vertical-align:top}th{background:#E8EEFB}
      pre{white-space:pre-wrap;background:#f1f5f9;padding:3mm;border-radius:2mm;font:9pt Consolas,monospace}code{font-family:Consolas,monospace}
      blockquote{margin:3mm 0;padding-left:4mm;border-left:2pt solid #94a3b8;color:#475569;font-style:italic}
      a{color:#${BLUE};text-decoration:none}.pl-code-bar,button,.pl-cursor{display:none!important}
      footer{position:fixed;bottom:-10mm;left:0;right:0;text-align:center;font-size:8pt;color:#94a3b8}
    </style></head><body>${doc.nombre ? `<h1 class="doc-t">${doc.nombre.replace(/[<>&]/g, "")}</h1>` : ""}${html}<footer>Creado con CB Pilot · CeBe Studio</footer></body></html>`);
    d.close();
    const go = () => { w.focus(); w.print(); setTimeout(() => f.remove(), 60000); };
    if (d.readyState === "complete") setTimeout(go, 150); else f.onload = () => setTimeout(go, 150);
  }

  // ---------------- Excel ----------------
  async function excel(doc) {
    await load("/assets/vendor/xlsx.mini.min.js");
    const X = window.XLSX, wb = X.utils.book_new();
    const hojas = (Array.isArray(doc.hojas) && doc.hojas.length ? doc.hojas : [{ nombre: "Hoja1", filas: [] }]).slice(0, 20);
    const used = new Set();
    hojas.forEach((h, i) => {
      const filas = (Array.isArray(h.filas) ? h.filas : []).slice(0, 5000).map(r => (Array.isArray(r) ? r : [r]).slice(0, 100));
      const ws = X.utils.aoa_to_sheet(filas.map(r => r.map(v => typeof v === "string" && /^=[A-Za-z]/.test(v) ? null : v)));
      // Fórmulas («=SUM(B2:B9)»): se guardan como fórmula de verdad, para que Excel las calcule.
      filas.forEach((r, ri) => r.forEach((v, ci) => { if (typeof v === "string" && /^=[A-Za-z]/.test(v)) ws[X.utils.encode_cell({ r: ri, c: ci })] = { t: "n", f: v.slice(1) }; }));
      if (filas.length) { const n = Math.max(...filas.map(r => r.length)); ws["!ref"] = X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: filas.length - 1, c: Math.max(0, n - 1) } }); ws["!cols"] = Array.from({ length: n }, (_, c) => ({ wch: Math.min(48, Math.max(8, ...filas.map(r => String(r[c] ?? "").length + 2))) })); }
      let name = String(h.nombre || `Hoja${i + 1}`).replace(/[\\/?*[\]:]/g, "").slice(0, 31) || `Hoja${i + 1}`;
      while (used.has(name.toLowerCase())) name = name.slice(0, 28) + "_" + (i + 1);
      used.add(name.toLowerCase());
      X.utils.book_append_sheet(wb, ws, name);
    });
    save(new Blob([X.write(wb, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), fileName(doc.nombre, "xlsx"));
  }

  // ---------------- PowerPoint ----------------
  async function powerpoint(doc) {
    await load("/assets/vendor/pptxgen.bundle.min.js");
    const pres = new window.PptxGenJS();
    pres.layout = "LAYOUT_WIDE"; pres.author = "CB Pilot"; pres.title = doc.nombre || "Presentación";
    pres.defineSlideMaster({ title: "CBP", background: { color: "FFFFFF" }, objects: [
      { rect: { x: 0, y: 0, w: "100%", h: 0.12, fill: { color: BLUE } } },
      { text: { text: "CB Pilot", options: { x: 11.4, y: 7.0, w: 1.7, h: 0.3, fontSize: 9, color: "94A3B8", align: "right" } } }
    ], slideNumber: { x: 0.4, y: 7.0, w: 0.6, h: 0.3, fontSize: 9, color: "94A3B8" } });
    const portada = pres.addSlide();
    portada.background = { color: DARK };
    portada.addShape(pres.ShapeType.rect, { x: 0.8, y: 3.55, w: 1.4, h: 0.08, fill: { color: BLUE } });
    portada.addText(doc.nombre || "Presentación", { x: 0.8, y: 1.6, w: 11.5, h: 1.9, fontSize: 40, bold: true, color: "FFFFFF", valign: "bottom", fontFace: "Calibri" });
    if (doc.subtitulo) portada.addText(doc.subtitulo, { x: 0.8, y: 3.8, w: 11.5, h: 0.8, fontSize: 18, color: "94A3B8" });
    for (const s of (Array.isArray(doc.diapositivas) ? doc.diapositivas : []).slice(0, 40)) {
      const sl = pres.addSlide({ masterName: "CBP" });
      sl.addText(String(s.titulo || ""), { x: 0.6, y: 0.4, w: 12.1, h: 0.9, fontSize: 30, bold: true, color: NAVY, fontFace: "Calibri" });
      const puntos = (Array.isArray(s.puntos) ? s.puntos : []).slice(0, 10).map(p => ({ text: String(p), options: { bullet: { code: "25CF" }, paraSpaceAfter: 10 } }));
      if (puntos.length) sl.addText(puntos, { x: 0.8, y: 1.5, w: 11.7, h: 5.2, fontSize: puntos.length > 6 ? 16 : 20, color: "1E293B", valign: "top", fontFace: "Calibri" });
      if (s.notas) sl.addNotes(String(s.notas));
    }
    await pres.writeFile({ fileName: fileName(doc.nombre, "pptx") });
  }

  window.CBPILOT_DOCS = {
    /** fmt: "word" | "pdf" | "excel" | "powerpoint". html: el contenido ya convertido (solo para PDF). */
    async download(doc, fmt, html) {
      if (fmt === "word") return word(doc);
      if (fmt === "pdf") return pdf(doc, html);
      if (fmt === "excel") return excel(doc);
      if (fmt === "powerpoint") return powerpoint(doc);
      throw new Error("Formato no soportado");
    }
  };
})();
