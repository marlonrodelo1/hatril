import 'server-only';

import { createSign } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';

import { dbAdmin } from '@/lib/db';
import { dispositivosPush } from '@/lib/db/schema';
import { captureException, captureMessage } from '@/lib/observability';

/**
 * El único sitio que manda notificaciones push, por Firebase Cloud Messaging.
 *
 * NUNCA LANZA
 * -----------
 * Lo llama `emitirNotificacion` después de apuntar el aviso en la campana, y
 * eso pasa dentro de aprobar una solicitud, comentar o repartir turnos. Una
 * push que no sale es una molestia: la campana ya lo tiene. Una excepción aquí
 * dejaría la acción a medias. Todo va en `try` y se cuenta a Sentry.
 *
 * SIN CONFIGURAR, NO HACE NADA
 * ----------------------------
 * Sin `FIREBASE_SERVICE_ACCOUNT` devuelve sin mandar, y lo dice una vez por
 * proceso, no una por aviso: en local o en un despliegue sin la variable, cada
 * «me gusta» llenaría Sentry de lo mismo.
 *
 * POR QUÉ `dbAdmin`
 * -----------------
 * Hay que leer los teléfonos de OTRA cuenta —la del destinatario—, que la RLS
 * de `dispositivos_push` no deja ver a nadie más que a su dueño. Es la misma
 * excepción que ya tiene `emitirNotificacion` para escribir el aviso, en el
 * mismo momento y por el mismo motivo.
 *
 * POR QUÉ SIN `firebase-admin`
 * ----------------------------
 * Para mandar hace falta un token de OAuth firmado con la clave de la cuenta
 * de servicio, y eso es un JWT RS256 y una petición: `node:crypto` lo hace.
 * El SDK entero de administración son decenas de dependencias en el servidor
 * para usar una sola llamada.
 */

type CuentaDeServicio = {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
};

export type MensajePush = {
  titulo: string;
  cuerpo: string | null;
  /** Ruta de la casa a la que lleva tocarla. La valida el teléfono otra vez. */
  enlace: string;
};

const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';

let cuenta: CuentaDeServicio | null | undefined;
let avisadoSinConfigurar = false;
let acceso: { token: string; caduca: number } | null = null;

function cuentaDeServicio(): CuentaDeServicio | null {
  if (cuenta !== undefined) return cuenta;

  const cruda = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!cruda) return (cuenta = null);

  try {
    // En base64 porque es un JSON con saltos de línea dentro de la clave, y
    // Dokploy y `.env.local` quieren una variable en una sola línea.
    const json = JSON.parse(Buffer.from(cruda, 'base64').toString('utf8'));
    if (!json.project_id || !json.client_email || !json.private_key) {
      throw new Error('a la cuenta de servicio le faltan campos');
    }
    return (cuenta = json as CuentaDeServicio);
  } catch (err) {
    void captureException(err, { action: 'push_cuenta_de_servicio' });
    return (cuenta = null);
  }
}

function base64url(datos: string | Buffer): string {
  return Buffer.from(datos).toString('base64url');
}

/** Un token de OAuth para FCM. Dura una hora; se renueva cinco minutos antes. */
async function tokenDeAcceso(c: CuentaDeServicio): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  if (acceso && acceso.caduca - 300 > ahora) return acceso.token;

  const audiencia = c.token_uri ?? 'https://oauth2.googleapis.com/token';
  const cabecera = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = base64url(
    JSON.stringify({ iss: c.client_email, scope: ALCANCE, aud: audiencia, iat: ahora, exp: ahora + 3600 }),
  );
  const firma = createSign('RSA-SHA256').update(`${cabecera}.${cuerpo}`).sign(c.private_key);
  const jwt = `${cabecera}.${cuerpo}.${base64url(firma)}`;

  const res = await fetch(audiencia, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Google no ha dado el token de FCM (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const datos = (await res.json()) as { access_token: string; expires_in: number };
  acceso = { token: datos.access_token, caduca: ahora + datos.expires_in };
  return acceso.token;
}

/**
 * Lo que FCM contesta cuando el token ya no sirve: la app se desinstaló, se
 * borraron sus datos o el token caducó. A esos no se les vuelve a escribir.
 */
function tokenMuerto(estado: number, cuerpo: string): boolean {
  if (estado === 404) return true;
  return /UNREGISTERED|registration token is not a valid|Requested entity was not found/i.test(cuerpo);
}

/**
 * Manda la push a todos los teléfonos de una cuenta. Si no tiene ninguno —lo
 * normal para quien solo usa la web— no hace nada.
 */
export async function enviarPush(authUserId: string, mensaje: MensajePush): Promise<void> {
  const c = cuentaDeServicio();
  if (!c) {
    if (!avisadoSinConfigurar) {
      avisadoSinConfigurar = true;
      await captureMessage('Push sin enviar: falta FIREBASE_SERVICE_ACCOUNT.');
    }
    return;
  }

  try {
    const telefonos = await dbAdmin
      .select({ token: dispositivosPush.token })
      .from(dispositivosPush)
      .where(eq(dispositivosPush.authUserId, authUserId));
    if (telefonos.length === 0) return;

    const acceso = await tokenDeAcceso(c);
    const muertos: string[] = [];

    await Promise.all(
      telefonos.map(async ({ token }) => {
        const res = await fetch(
          `https://fcm.googleapis.com/v1/projects/${c.project_id}/messages:send`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${acceso}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              message: {
                token,
                notification: {
                  title: mensaje.titulo,
                  ...(mensaje.cuerpo ? { body: mensaje.cuerpo } : {}),
                },
                data: { enlace: mensaje.enlace },
                // El canal lo crea la app (`push-nativo.tsx`); si aún no
                // existe, Android usa el suyo de reserva y llega igual.
                android: {
                  priority: 'HIGH',
                  notification: { sound: 'default', channel_id: 'avisos' },
                },
                apns: { payload: { aps: { sound: 'default' } } },
              },
            }),
            signal: AbortSignal.timeout(8000),
          },
        );
        if (res.ok) return;

        const cuerpo = await res.text();
        if (tokenMuerto(res.status, cuerpo)) {
          muertos.push(token);
          return;
        }
        await captureMessage(`FCM no ha entregado una push (${res.status}): ${cuerpo.slice(0, 300)}`);
      }),
    );

    if (muertos.length > 0) {
      await dbAdmin.delete(dispositivosPush).where(inArray(dispositivosPush.token, muertos));
    }
  } catch (err) {
    await captureException(err, { action: 'enviar_push' });
  }
}
