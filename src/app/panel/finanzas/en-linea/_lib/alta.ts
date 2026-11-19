import 'server-only';

import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { getOrigin } from '@/lib/auth/get-origin';
import type { UserContext } from '@/lib/auth/user-context';
import { withUser } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';
import { enlaceDeAlta } from '@/lib/donativos/stripe-connect';
import { captureException } from '@/lib/observability';

/**
 * Lo que comparten las dos puertas al alta de Stripe: el botón de la página
 * (`conectarStripe`, una action) y el `refresh_url` de Stripe (`conectar/route.ts`,
 * un GET). Aquí y no en una de las dos porque un fichero `'use server'` solo
 * puede exportar funciones asíncronas, y el mensaje de cada fallo tiene que ser
 * el mismo venga la persona por donde venga.
 */

export const DESTINO_EN_LINEA = '/panel/finanzas/en-linea';

export const MENSAJE_SOLO_ESPANA =
  'Por ahora, las ofrendas con tarjeta son solo para iglesias de España, en euros.';

/**
 * España y euros (decisión 4). Es la misma regla que `resumenEnLinea` y
 * `cobraConTarjeta` de `lib/donativos/consultas.ts`, que no la exportan.
 *
 * Hace falta también en el servidor y no solo en la pantalla: `enlaceDeAlta`
 * crea la cuenta con `country: 'ES'`, y un POST fabricado desde una iglesia de
 * Bogotá abriría una cuenta española a su nombre.
 */
export function paisAdmitido(iglesia: { pais: string; moneda: string }): boolean {
  return iglesia.pais === 'ES' && iglesia.moneda === 'EUR';
}

const correoValido = z.email();

/**
 * El enlace al alta, o el mensaje que hay que darle a la persona.
 *
 * Captura aquí y devuelve el error en vez de lanzarlo para que quien llama
 * pueda hacer `redirect()` FUERA de cualquier `try`: dentro, el catch atraparía
 * la redirección a Stripe, que funciona lanzando, y un alta que iba bien
 * acabaría en «no se ha podido».
 */
export async function abrirAlta(
  ctx: UserContext,
): Promise<{ url: string } | { error: string }> {
  // El correo de la iglesia, el que pone en Ajustes, y no el del pastor: la
  // cuenta de Stripe es de la iglesia. Por `withUser`: es su propia fila.
  const [fila] = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ email: iglesias.email })
      .from(iglesias)
      .where(eq(iglesias.id, ctx.iglesia.id))
      .limit(1),
  );
  // Ajustes guarda lo que se teclee. Uno mal escrito tumbaría la creación de
  // la cuenta entera con «Invalid email address», así que sin él: Stripe lo
  // pide en su propio formulario.
  const email = fila?.email?.trim();

  try {
    const url = await enlaceDeAlta(
      {
        id: ctx.iglesia.id,
        nombre: ctx.iglesia.nombre,
        email: email && correoValido.safeParse(email).success ? email : null,
      },
      await getOrigin(),
    );
    return { url };
  } catch (err) {
    await captureException(err, {
      action: 'conectar_stripe',
      iglesiaId: ctx.iglesia.id,
    });
    return { error: mensajeDeFallo(err) };
  }
}

/**
 * Tres situaciones distintas para quien está delante, y el detalle a Sentry.
 *
 * Por el `type` que pone la librería de Stripe a cada error, sin `instanceof`:
 * así no hace falta importar la clase aquí. Lo de la plataforma —Connect sin
 * activar en la cuenta de Rogotech, una clave mal puesta— no lo puede arreglar
 * el pastor, y decirle «inténtalo en un momento» le haría volver a pulsar toda
 * la tarde.
 */
function mensajeDeFallo(err: unknown): string {
  const e = (err ?? {}) as { type?: unknown; message?: unknown };
  const tipo = typeof e.type === 'string' ? e.type : '';
  const mensaje = typeof e.message === 'string' ? e.message : '';

  if (tipo === 'StripeConnectionError' || tipo === 'StripeAPIError' || tipo === 'StripeRateLimitError') {
    return 'Stripe no responde ahora mismo. Vuelve a intentarlo en un momento.';
  }
  if (
    tipo === 'StripeAuthenticationError' ||
    tipo === 'StripePermissionError' ||
    (tipo === 'StripeInvalidRequestError' && /connect/i.test(mensaje))
  ) {
    return 'Los pagos con tarjeta no se pueden activar ahora mismo por un ajuste que nos toca a nosotros, no a tu iglesia. No hace falta que vuelvas a pulsar.';
  }
  return 'No se ha podido abrir el alta en Stripe. Vuelve a intentarlo en un momento.';
}
