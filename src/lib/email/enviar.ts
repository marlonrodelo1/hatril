import 'server-only';

import { Resend } from 'resend';

import { captureException, captureMessage } from '@/lib/observability';

/**
 * El único sitio que manda correo.
 *
 * SIN CONFIGURAR NO FALLA, AVISA
 * ------------------------------
 * Con `RESEND_API_KEY` o `RESEND_FROM_EMAIL` vacías devuelve `false` y deja
 * constancia en Sentry, sin lanzar. Lo llama el webhook de Stripe después de
 * apuntar un pago: si lanzara, el webhook devolvería 500 y Stripe reintentaría
 * un cobro ya apuntado. Un recibo que no sale es una molestia; un webhook que
 * no termina es dinero sin apuntar.
 */
let cliente: Resend | null = null;

export async function enviarCorreo(correo: {
  para: string;
  asunto: string;
  html: string;
  texto: string;
  /** El nombre que ve quien lo recibe: «Iglesia Sion». La dirección es siempre la nuestra. */
  deNombre?: string;
}): Promise<boolean> {
  const clave = process.env.RESEND_API_KEY;
  const desde = process.env.RESEND_FROM_EMAIL;
  if (!clave || !desde) {
    await captureMessage(`Correo sin enviar (Resend sin configurar): «${correo.asunto}».`);
    return false;
  }

  cliente ??= new Resend(clave);
  try {
    const { error } = await cliente.emails.send({
      // El nombre de la iglesia delante de nuestra dirección: así se ve quién
      // escribe sin hacerse pasar por su dominio.
      from: correo.deNombre ? `${correo.deNombre.replace(/[<>"]/g, '')} <${desde}>` : desde,
      to: correo.para,
      subject: correo.asunto,
      html: correo.html,
      text: correo.texto,
    });
    if (error) {
      await captureMessage(`Resend no ha enviado «${correo.asunto}»: ${error.message}`);
      return false;
    }
    return true;
  } catch (err) {
    await captureException(err, { action: 'enviar_correo' });
    return false;
  }
}
