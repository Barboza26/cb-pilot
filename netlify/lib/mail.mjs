// Envío de correos (por ahora solo «recuperar contraseña») con Resend (resend.com, plan gratis de 3000 correos al mes).
// Variables: RESEND_API_KEY y MAIL_FROM (por ejemplo: CB Pilot <no-responder@cebestudiocr.com>).
// El dominio del remitente debe estar verificado en Resend. Sin estas variables, CB Pilot no envía correos
// y la recuperación sigue por WhatsApp.
let fetchImpl = (...a) => fetch(...a);
export function setMailFetch(f) { fetchImpl = f; }
export const mailOn = () => !!process.env.RESEND_API_KEY && !!process.env.MAIL_FROM;

export async function sendMail({ to, subject, html, text }) {
  if (!mailOn()) return false;
  try {
    const res = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM, to: [to], subject, html, text })
    });
    if (!res.ok) { console.error("[correo] Resend respondió", res.status, (await res.text()).slice(0, 300)); return false; }
    return true;
  } catch (e) { console.error("[correo] no se pudo enviar", e?.message); return false; }
}
