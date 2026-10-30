# CB Pilot — Hoja de ruta

**CB Pilot**, la inteligencia artificial de propósito general creada por **CeBe Studio** en Costa Rica 🇨🇷. Mascota: **Pilo**, una lapa roja con gafas de aviador. Habla por defecto en **tico amigable con ustedeo** (también neutro o formal) y siempre adapta el tono al contexto.

Referencia visual: el ícono con las letras **CB** grandes y el tablero conceptual (mundos inmersivos, cabina de mando, expresiones de Pilo).

| Fase | Qué incluye | Estado |
|---|---|---|
| 1 · Auditoría | Revisión de archivos, funciones, dependencias y riesgos | ✅ 30/10/2026 |
| 2 · Rediseño visual base | Marca CB Pilot + sello CeBe Studio; menú lateral (Conversaciones, Torre de control, Explorar mundos, Cabina de mando, Configuración); inicio en tarjeta de vidrio con la caja de texto al centro y acciones rápidas reales; nombre de Pilo y del asistente en cada respuesta; Cabina de mando (uso real, Crucero/Turbo, Modo Ahorro); Configuración; bienvenida para elegir la forma de hablar; tema CB Pilot Original con los colores de CeBe Studio | ✅ 30/10/2026 |
| 3 · Integración de Pilo | Sistema de estados reutilizable (saludar, pensar, procesar, celebrar, volar, descansar, reaccionar al escribir) con las ilustraciones 3D oficiales | Pendiente — **necesita las ilustraciones de Pilo en PNG/WebP con fondo transparente** |
| 4 · Mundo Selva | Paisaje por capas con parallax, hojas, rayos de sol, partículas, mariposas, luciérnagas de noche, sonidos opcionales; Pilo sobre una rama | Pendiente |
| 5 · Sistema de mundos | Módulos por mundo, transición entre mundos sin recargar ni perder la conversación | Pendiente |
| 6 · Mundos restantes | Arenal, Caribe, Pacífico, Bandera y CB Pilot Original con su ambiente | Pendiente |
| 7 · Biblioteca descargable | Vista previa, tamaño, instalar/activar y caché local | Pendiente |
| 8 · PWA | Service Worker, caché controlada, instalación, actualizaciones, sin conexión | Pendiente (ya hay manifiesto e íconos provisionales) |
| 9 · Funciones avanzadas | Chats sincronizados, memoria opcional con controles, documentos Word/PDF/Excel, imágenes, voz, planes Gratuito / Intermedio / Pro, pagos | Pendiente — se propone arquitectura antes de implementar |

## Lo que ya funciona (no se toca sin necesidad)
Chat con Claude en streaming y continuación automática; varios chats a la vez; Torre de control (tareas en paralelo); vista previa de páginas HTML; adjuntos (fotos, PDF, texto); dictado por voz; asistentes; base de conocimiento; cuentas con inicio de sesión; planes y códigos; panel de administración; presupuesto y límites desde el servidor; temas claro/oscuro; ES/EN.

## Costos (qué es gratis y qué no)
- **Gratis:** HTML/CSS/JS, animaciones (CSS, Web Animations, Canvas), PWA, Netlify plan gratuito con límites, Netlify Blobs dentro del plan.
- **Con costo por uso:** la API de Claude (cada mensaje), Netlify al pasar los créditos del plan.
- **Requiere servicio pago si se agrega:** generación de imágenes, voz realista para Pilo, procesamiento de pagos (comisión por venta), correos (hay planes gratuitos limitados).
