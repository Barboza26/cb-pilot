# CB Pilot — plan, costos e ideas

## 1. Proveedor recomendado: Claude (Anthropic)

**Por qué:** buena calidad en español, muy buenos para escribir y programar, tres tamaños de modelo con el mismo sistema (podés subir o bajar de plan sin cambiar código), y herramientas para controlar costos (caché de instrucciones, esfuerzo ajustable).

| Plan | Nombre que ve el cliente | Modelo | Precio por millón de tokens (entrada / salida) | Costo aproximado por mensaje* | Mensajes con US$25 |
|---|---|---|---|---|---|
| Gratis | Pilot Flash | Claude Haiku 5.5 | US$0.10 / US$0.50 | ≈ US$0.001 | ≈ 25 000 |
| Pro | Pilot Pro | Claude Sonnet 5.5 | US$2 / US$10 | ≈ US$0.015 – 0.03 | ≈ 800 – 1 600 |
| Max | Pilot Max | Claude Opus 5.5 | US$4 / US$20 | ≈ US$0.03 – 0.06 | ≈ 400 – 800 |

\* Mensaje típico: unas 4 500 palabras-token de entrada (instrucciones + historial) y 600 de salida. Una landing completa cuesta 3 o 4 veces más. Son estimaciones: el gasto real aparece en el panel.

**Conclusión con US$25 al mes:** el plan gratis con Haiku es casi regalado (unos 700 mensajes por día alcanzan), así que podés ofrecerlo sin miedo. Pro y Max se pagan con lo que venden.

### Precios sugeridos de los planes (PROVISIONALES — decidilos vos)

| Plan | Costo máximo para vos al mes (uso total del plan) | Precio sugerido | Margen en el peor caso |
|---|---|---|---|
| Pro (500 mensajes/mes) | ≈ US$15 | **₡9 900 / mes** | ≈ 25 % (normalmente mucho más: casi nadie usa el 100 %) |
| Max (300 mensajes/mes) | ≈ US$18 | **₡19 900 / mes** | ≈ 50 % |

Calculado con unos ₡500 por dólar; revisá el tipo de cambio. Mientras no cargues un precio en el panel, la web muestra «Precio por WhatsApp».

**Regla de oro:** cada vez que vendas un plan, subí el presupuesto del panel en lo que cuesta ese plan (≈ US$15 por Pro y ≈ US$18 por Max). Así el plan gratis nunca se come lo que pagan los clientes.

---

## 2. Banco de ideas (lo que sigue)

✅ = se puede hacer bien con lo que ya tenemos · ⚠️ = se puede, con costo o cuidado · ❌ = no conviene / no es posible

### Ya hecho
- ✅ **Base de conocimiento** (enlaces, archivos y textos que la IA consulta y cita).

### Para la base de conocimiento
| Idea | Viabilidad | Nota |
|---|---|---|
| Leer un sitio completo desde su `sitemap.xml` | ✅ | Con un límite de páginas para no pasar el tiempo de Netlify. |
| Actualizar los enlaces solos cada semana | ✅ | Función programada de Netlify. |
| «Guardar en la base» desde una respuesta del chat (para el dueño) | ✅ | Así lo que Pilot responde bien queda como conocimiento. |
| Bases distintas por plan o por cliente («Tu propio Pilot») | ⚠️ | La pieza clave para vender asistentes a otros negocios. |
| Búsqueda por significado (embeddings) en vez de por palabras | ⚠️ | Anthropic no ofrece embeddings; requiere otro proveedor. Útil recién con miles de fuentes. |
| Word (.docx) y Excel directos | ⚠️ | Librerías extra; hoy se resuelve guardándolos como PDF o CSV. |

### A. Experiencia de chat
| Idea | Viabilidad | Nota |
|---|---|---|
| **Subir fotos** («mirá mi logo y decime qué colores usar», «¿qué dice esta factura?») | ✅ | Claude ve imágenes. Para Pro y Max primero (cuesta más). |
| **Subir PDF** (resumir, estudiar, contratos) | ✅ | Hasta ~5 MB por el límite de Netlify. |
| **Leer la respuesta en voz alta** | ✅ | Gratis, lo hace el navegador. |
| **Dictar por voz** | ⚠️ | Hay que permitir el micrófono en `_headers`; no todos los navegadores lo soportan igual. |
| **Asistentes especializados** (Community Manager, Profe, Programador, Redactor, Coach) | ✅ | Solo cambian las instrucciones; barato y vistoso. |
| «Sobre mí» (el usuario guarda sus datos y estilo una vez) | ✅ | Guardado en el dispositivo. |
| Respuesta corta / normal / detallada | ✅ | |
| Exportar el chat a PDF o Markdown | ✅ | |
| Carpetas o proyectos de chats | ✅ | |
| Búsqueda en internet con fuentes | ⚠️ | Claude la trae integrada (Pro y Max); cada búsqueda cuesta extra. |
| Compartir un chat por enlace | ⚠️ | Obliga a guardar conversaciones en el servidor (privacidad). |
| Generar imágenes | ⚠️ | Claude no genera imágenes; habría que sumar otro proveedor. |
| Instalarla como app en el celular | ✅ | Ya tiene manifiesto e íconos; falta un «modo sin conexión» básico. |

### B. Vista previa y diseño
| Idea | Viabilidad | Nota |
|---|---|---|
| Editar la landing con instrucciones y ver versiones | ✅ | |
| Botón **«Hacerla real con CeBe Studio»** en la vista previa (abre WhatsApp de CeBe con el diseño) | ✅ | Conecta CB Pilot con CeBe sin mezclar los sitios. |
| Publicar la landing en un enlace temporal | ⚠️ | Necesita moderación. |

### C. Tareas y agentes
| Idea | Viabilidad |
|---|---|
| **Kit de lanzamiento encadenado** (nombre → eslogan → textos → posts → landing) | ✅ |
| Tareas largas en segundo plano con aviso al terminar | ⚠️ |
| Comparar respuestas de dos modelos | ✅ |

### D. Negocio
| Idea | Viabilidad | Nota |
|---|---|---|
| **Pago automático de planes** (tarjeta o SINPE con verificación) que crea y envía el código solo | ⚠️ | Necesita proveedor de pagos o un flujo de pedidos como el de CeBe. |
| Prueba de Pro por 3 días | ✅ | Código de 3 días. |
| **Widget de CB Pilot para otras webs** (incluida la de CeBe Studio o las de sus clientes) | ⚠️ | Servicio mensual con mucho potencial; requiere presupuesto por cliente. |
| Cuentas con enlace mágico (chats en todos tus dispositivos) | ⚠️ | Guardar chats en el servidor implica actualizar la privacidad. |
| Plan Empresas / equipos | ⚠️ | Requiere cuentas. |
| Referidos | ✅ | |

### E. Administración
| Idea | Viabilidad |
|---|---|
| Correo de alerta al 50 %, 80 % y 100 % del presupuesto | ✅ |
| Resumen de 👍/👎 (sin guardar el texto) | ✅ |
| Editor de la personalidad desde el panel | ✅ |
| Protección anti-bots (Cloudflare Turnstile) | ⚠️ |

### Lo que NO conviene o no se puede
- ❌ Entrenar un modelo propio desde cero (cuesta millones). «Propio» = tu marca, tu diseño, tu conocimiento y tus herramientas sobre un modelo de Anthropic.
- ❌ Gratis ilimitado: cada mensaje cuesta.
- ❌ Usar el nombre, el logo o el diseño exacto de ChatGPT, Gemini o Claude.
- ❌ Poner la clave de la IA en el navegador o ejecutar en el servidor código que escriba la IA.

## 3. Próximos pasos recomendados
1. Publicar el sitio y activar la clave (ver `README.md`).
2. Comprar un dominio propio para CB Pilot.
3. Fotos y PDF para Pro y Max.
4. Asistentes especializados.
5. Pago automático de planes.
