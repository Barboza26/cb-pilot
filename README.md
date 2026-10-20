# CB Pilot

Asistente de inteligencia artificial independiente, al estilo de ChatGPT, Gemini o Claude: chat en vivo, varios chats respondiendo a la vez, **Modo Tareas** en paralelo, vista previa de diseños HTML y planes Gratis / Pro / Max con códigos de acceso.

Funciona con modelos Claude de Anthropic. Cuando alguien necesita una página web profesional, recomienda a **CeBe Studio** (sitio aparte: https://cebestudiocr.com).

> Costos, precios sugeridos y banco de ideas: **`PLAN.md`**.

## Qué incluye

| Función | Detalle |
|---|---|
| Chat en vivo | La respuesta aparece mientras se escribe; detener, copiar, regenerar, editar, continuar, 👍/👎. |
| Varios chats a la vez | Un chat sigue respondiendo mientras escribís en otro (punto azul en el historial). |
| Modo Tareas | Varias tareas (una por línea) resueltas en paralelo, con paquetes listos. Cada tarjeta se copia o se abre como chat. |
| Vista previa | Las landings y diseños HTML se ven en vivo (escritorio o celular) y se descargan. Aislada, sin scripts. |
| Historial | Buscar, fijar, renombrar y eliminar. Se guarda **solo en el dispositivo** del usuario. |
| Planes | Gratis (Claude Haiku 5.5), Pro (Claude Sonnet 5.5) y Max (Claude Opus 5.5), con códigos de acceso que crea el dueño. |
| **Base de conocimiento** | Desde el panel le das enlaces, archivos (PDF, TXT, MD, CSV, JSON, HTML) o textos. CB Pilot los consulta antes de responder y muestra «Fuentes consultadas» bajo la respuesta. Cuanto más agregás, más sabe. |
| Panel `/admin/` | Gasto del mes contra el presupuesto, mensajes por plan y por día, pausa inmediata, precios, códigos, base de conocimiento y auditoría. |
| Presupuesto | Tope mensual (US$25 por defecto); el plan gratis se pausa al 70 % para reservar el resto a quienes pagan. |
| Idiomas | Español e inglés (detecta el idioma del navegador). |
| Celular | Historial deslizable, vista previa a pantalla completa, instalable como app. |
| Legal | `/privacidad/` y `/terminos/` (revisalos con asesoría legal antes de lanzar). |

## Publicarlo (una sola vez)

1. **Netlify:** *Add new project → Import an existing project → GitHub →* este repositorio. Netlify lee `netlify.toml` solo (publica `public/` y la API de `netlify/functions/`).
2. **Variables de entorno** (Project configuration → Environment variables):

   | Variable | Para qué | Obligatoria |
   |---|---|---|
   | `ANTHROPIC_API_KEY` | Clave de la IA (console.anthropic.com → API Keys). Empieza con `sk-ant-`. | Sí |
   | `ADMIN_SETUP_CODE` | Código secreto (mínimo 12 caracteres) para crear tu usuario del panel la primera vez. | Sí |
   | `PILOT_WHATSAPP` | Número que recibe las compras de planes (código de país + número, solo dígitos). Por defecto `50689337817`. | No |
   | `PILOT_BUDGET_USD` | Presupuesto inicial antes de guardarlo en el panel. Por defecto 25. | No |
   | `PILOT_DEADLINE_MS` | Corte de cada tramo de respuesta en vivo (ver «Límites»). Por defecto 8500. | No |

3. **Anthropic:** en la consola cargá saldo y poné un **límite de gasto mensual** (Settings → Limits). Es el doble seguro del presupuesto del panel.
4. Volvé a publicar, entrá a `/admin/`, creá tu usuario con el `ADMIN_SETUP_CODE` y revisá presupuesto y precios.
5. **Dominio (opcional):** Domain management → agregá el dominio de CB Pilot. Después, en el sitio de CeBe Studio, poné esa dirección en `assets/js/cebe-config.js` → `pilotUrl`.

Cada pull request genera una vista previa aislada: sus datos van a almacenes `preview-*`, separados de producción.

## Vender un plan

1. El cliente toca «Quiero Pro» (abre WhatsApp) y paga por SINPE.
2. `/admin/` → **Crear código**: plan, días de vigencia (30) y nombre del cliente.
3. «Copiar mensaje para el cliente» y pegáselo por WhatsApp. El código se muestra **una sola vez** (el servidor guarda solo una huella).
4. El cliente lo activa en CB Pilot → Planes. «Desactivar» le quita el acceso al instante.

## Enseñarle cosas nuevas (base de conocimiento)

`/admin/` → **Conocimiento**:

- **Enlaces:** pegá hasta 5 por vez (páginas o PDF públicos). «Actualizar» vuelve a leerlos cuando la página cambia; el mismo enlace nunca se duplica.
- **Archivos:** PDF, TXT, MD, CSV, JSON o HTML de hasta 5 MB. Los de Word, guardalos como PDF.
- **Texto:** notas, preguntas frecuentes, precios, políticas.
- **Probar:** escribís una pregunta y ves qué fragmentos encontraría.
- Cada fuente se puede ver (cómo la leyó), desactivar o eliminar.

Cómo la usa: mientras la base sea chica (hasta ~24 000 caracteres) se le da completa en cada mensaje, guardada en caché (barato). Cuando crece, busca solo los fragmentos relacionados con la pregunta (búsqueda por palabras, sin servicios externos) y le da hasta ~14 000 caracteres. Capacidad: 500 fuentes y 6 millones de caracteres. Lo que dicen las fuentes se trata como información, nunca como instrucciones.

**Costo:** cada mensaje lleva algo más de texto. Con el plan gratis (Haiku) sigue siendo una fracción de centavo; en Pro y Max puede sumar alrededor de US$0,01 por mensaje cuando la base es grande.

## Probar en tu computadora (sin gastar)

```bash
npm install
npm test        # pruebas de la API y de la base de conocimiento, con IA simulada
npm run dev     # http://localhost:8899 con respuestas simuladas; panel con el código codigo-local-123
```

Con `ANTHROPIC_API_KEY=sk-ant-… ADMIN_SETUP_CODE=codigo-local-123 node tests/servidor-local.mjs 8899` usa la IA real.

## Límites técnicos

- **Netlify corta las respuestas en vivo a los ~10 s.** CB Pilot corta a los 8,5 s y pide la continuación sola; el usuario ve la respuesta completa y la continuación no cuenta como mensaje nuevo. Si tu plan de Netlify permite más, subí `PILOT_DEADLINE_MS`.
- El límite gratis es por conexión (IP): personas en la misma red wifi lo comparten.
- Los chats viven en el navegador: si el usuario borra los datos del sitio, los pierde.

## Dónde está cada cosa

| Parte | Archivo |
|---|---|
| Planes, límites, presupuesto, códigos, personalidad y conversación con Claude | `netlify/lib/pilot.mjs` (`PLANS`, `PERSONA`, `CEBE`) |
| Base de conocimiento (lectura de páginas y PDF, fragmentos, búsqueda) | `netlify/lib/knowledge.mjs` |
| Rutas de la API | `netlify/functions/api.mjs` |
| Acceso del panel, base de datos y utilidades | `netlify/lib/admin.mjs`, `db.mjs`, `util.mjs`, `log.mjs` |
| La app | `public/index.html`, `public/assets/js/pilot.js`, `public/assets/css/pilot.css` |
| Base compartida (idioma, estilos) | `public/assets/js/core.js`, `public/assets/css/base.css` |
| Panel | `public/admin/index.html`, `public/assets/js/admin.js`, `public/assets/css/admin.css` |
| Legales | `public/privacidad/`, `public/terminos/` |
| Seguridad (CSP, HSTS) | `public/_headers` |
| Pruebas, IA simulada y servidor local | `tests/` |

Para cambiar lo que Pilot sabe de CeBe Studio (demos, precios, enlaces), editá `CEBE` en `netlify/lib/pilot.mjs`.
