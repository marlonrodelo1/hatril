import 'server-only';

import {
  leerEstadoSuscripcion,
  suscripcionBloquea,
  type EstadoSuscripcion,
} from '@/lib/suscripcion/estado';
import { jsonCors, type SalonBearerContext } from '@/lib/auth/salon-bearer';

/**
 * Muro de suscripción para la API de la app del negocio (`/api/panel-app/*`).
 *
 * El panel web cierra la puerta cuando la prueba vence (`TrialBlocker`), pero la
 * app NO miraba el plan en ningún punto: un salón vencido, cancelado o de
 * cortesía caducada seguía trabajando con normalidad desde el móvil. No era solo
 * un despiste de pantalla —era de servidor—, así que tampoco bastaba con
 * arreglar la app: un APK viejo o una llamada directa seguirían entrando.
 *
 * DOS DECISIONES que se apartan a propósito de copiar el muro web tal cual:
 *
 * 1. LECTURA CON GRACIA. Cerrar de golpe deja a un salón sin agenda en plena
 *    jornada, con clientes en la puerta, por un recibo devuelto de ayer. Durante
 *    `DIAS_GRACIA_LECTURA` tras el vencimiento las consultas (GET) siguen
 *    pasando y solo se bloquea escribir. Pasado ese plazo se cierra entero.
 *    Consultar no da de comer al negocio; crear citas, sí. La fuga se tapa igual.
 *
 * 2. NUNCA SE BLOQUEA LO QUE SIRVE PARA PAGAR NI PARA IRSE. Si el muro tapara el
 *    puente al pago, el dueño quedaría encerrado sin forma de reactivar desde el
 *    móvil; y si tapara el borrado de cuenta, incumpliríamos el requisito de
 *    Apple que obliga a poder borrarla desde dentro.
 */

/** Días tras el vencimiento en los que aún se puede CONSULTAR (no escribir). */
export const DIAS_GRACIA_LECTURA = 3;

/** Métodos que solo leen. El resto mueve dinero, agenda o configuración. */
const METODOS_LECTURA = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OpcionesGuard {
  /**
   * Marca la operación como de solo lectura aunque el método no lo sea. Para el
   * puñado de endpoints que consultan vía POST (búsquedas con cuerpo).
   */
  soloLectura?: boolean;
}

/**
 * Devuelve una respuesta 402 si el salón no puede operar, o `null` si puede
 * seguir. Se usa justo después de resolver el contexto:
 *
 *     const ctx = await getSalonFromBearer(req);
 *     if (!ctx) return noAutenticado(req);
 *     const bloqueo = bloqueoPorSuscripcion(req, ctx);
 *     if (bloqueo) return bloqueo;
 *
 * 402 (Pago requerido) y no 403: el 403 significa "tu rol no llega" y la app ya
 * lo usa para eso. Este caso es distinto —la cuenta entera está sin pagar— y
 * merece una pantalla propia, no un "no tienes permiso" que confunde al empleado.
 */
export function bloqueoPorSuscripcion(
  req: Request,
  ctx: SalonBearerContext,
  opts: OpcionesGuard = {},
): Response | null {
  const estado = leerEstadoSuscripcion(
    ctx.salon as unknown as Record<string, unknown>,
  );
  if (!suscripcionBloquea(estado)) return null;

  const esLectura = opts.soloLectura || METODOS_LECTURA.has(req.method.toUpperCase());
  if (esLectura && dentroDeGracia(ctx.salon.trialUntil)) return null;

  const esDuenoOAdmin = ctx.rol === 'dueno' || ctx.rol === 'admin';

  return jsonCors(
    req,
    {
      error: 'suscripcion_requerida',
      mensaje: esDuenoOAdmin
        ? 'Tu suscripción no está activa. Actívala para seguir usando la app.'
        : 'La suscripción de este negocio no está activa. Avisa al responsable para reactivarla.',
      // La app decide con esto si enseña el botón de pagar o solo el aviso: a un
      // empleado no se le manda a la pantalla de facturación, que la web le
      // cierra de todos modos.
      puedeGestionarPago: esDuenoOAdmin,
      estado: {
        trialExpirado: estado.trialExpirado,
        planActivo: estado.planActivo,
        sinSuscripcion: estado.sinSuscripcion,
      },
    },
    { status: 402 },
  );
}

/** ¿Sigue dentro del plazo de gracia de solo lectura tras el vencimiento? */
function dentroDeGracia(trialUntil: Date | string | null): boolean {
  if (!trialUntil) return false;
  const fin = trialUntil instanceof Date ? trialUntil : new Date(String(trialUntil));
  if (Number.isNaN(fin.getTime())) return false;
  const limite = fin.getTime() + DIAS_GRACIA_LECTURA * 24 * 60 * 60 * 1000;
  return Date.now() < limite;
}

/** Reexport para que las pantallas de servidor no importen de dos sitios. */
export type { EstadoSuscripcion };
