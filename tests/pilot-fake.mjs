// Cliente de Claude SIMULADO para pruebas y para el servidor local (PILOT_FAKE=1): no usa internet ni gasta dinero.
// Imita client.messages.stream(): eventos message_start → text_delta… → message_delta, y abort().
const sleep = ms => new Promise(r => setTimeout(r, ms));

const LANDING = `¡Claro! Aquí tenés una landing para **Aroma Tico** ☕. Tocá **Vista previa** para verla en vivo.

\`\`\`html
<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Aroma Tico</title>
<style>
body{margin:0;font-family:system-ui,sans-serif;background:#1b120c;color:#fdf6ec}
header{padding:4rem 1.5rem;text-align:center;background:linear-gradient(160deg,#3b2416,#1b120c)}
h1{font-size:clamp(2.2rem,6vw,4rem);margin:0 0 .5rem}
p{color:#e9d8c4;max-width:46ch;margin:0 auto 1.5rem}
a.btn{display:inline-block;background:#25D366;color:#062e16;padding:.9rem 1.4rem;border-radius:999px;font-weight:700;text-decoration:none}
.menu{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:1rem;padding:2rem 1.5rem;max-width:900px;margin:auto}
.item{background:#2a1b12;border:1px solid #4a3324;border-radius:16px;padding:1.2rem}
.item b{display:block;font-size:1.1rem}.item span{color:#f0b46a}
</style></head><body>
<header><h1>Aroma Tico</h1><p>Café de altura de Tarrazú, tostado en casa y servido con cariño.</p><a class="btn" href="#">Pedí por WhatsApp</a></header>
<section class="menu"><div class="item"><b>Espresso</b><span>₡1 500</span></div><div class="item"><b>Capuchino</b><span>₡2 200</span></div><div class="item"><b>Chorreado</b><span>₡1 800</span></div></section>
</body></html>
\`\`\`

Si te gusta, en CeBe Studio la convertimos en tu web real. [Hablar por WhatsApp](https://wa.me/50689337817?text=Hola%2C%20quiero%20mi%20web)`;

const GENERAL = `## ¡Hola! Soy CeBe Pilot 👋

Estoy en **modo de prueba** (respuesta simulada, sin IA real). Así se ven mis respuestas:

- Listas con **negritas**, _cursivas_ y \`código\`
- Enlaces como [la tienda de CeBe Studio](https://cebestudiocr.com/tienda/)
- Tablas y bloques de código

| Plan | Modelo | Tareas a la vez |
|---|---|---|
| Gratis | Pilot Flash | 2 |
| Pro | Pilot Pro | 4 |
| Max | Pilot Max | 6 |

\`\`\`js
const saludo = nombre => \`¡Pura vida, \${nombre}!\`;
console.log(saludo("Carlos"));
\`\`\`

> Configurá \`ANTHROPIC_API_KEY\` en Netlify para respuestas reales.`;

export function fakeClient({ delay = 8, reply, stop = "end_turn" } = {}) {
  const calls = [];
  const stream = params => {
    calls.push(params);
    let aborted = false;
    const last = String(params.messages[params.messages.length - 1]?.content || "");
    const text = typeof reply === "function" ? reply(params) : reply ?? (/landing|página|web/i.test(last) ? LANDING : GENERAL);
    async function* events() {
      yield { type: "message_start", message: { model: params.model, usage: { input_tokens: 1500, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } } };
      yield { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } };
      for (const chunk of text.match(/[\s\S]{1,8}/g) || []) {
        await sleep(delay);
        if (aborted) throw Object.assign(new Error("Request was aborted."), { name: "APIUserAbortError" });
        yield { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: chunk } };
      }
      yield { type: "content_block_stop", index: 0 };
      yield { type: "message_delta", delta: { stop_reason: typeof stop === "function" ? stop(params) : stop }, usage: { output_tokens: Math.ceil(text.length / 4) } };
    }
    const it = events();
    return { abort() { aborted = true; }, [Symbol.asyncIterator]() { return it; } };
  };
  return { calls, messages: { stream }, beta: { messages: { stream } } };
}
