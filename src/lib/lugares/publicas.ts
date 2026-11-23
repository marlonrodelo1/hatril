import 'server-only';

import { z } from 'zod';

import { captureException } from '@/lib/observability/sentry';
import { checkRateLimit } from '@/lib/api/rate-limit';
import {
  LugaresFallo,
  LugaresSinConfigurar,
  detalleLugar,
  sugerirLugares,
  type Lugar,
  type Sugerencia,
} from './google';

/**
 * Lo que hay detrás de las cuatro rutas de lugares: `/api/v1/lugares/*` para
 * la web y `/api/v1/app/lugares/*` para la app. Las mismas dos preguntas con
 * el mismo freno; cada ruta solo cambia cómo se contesta.
 *
 * PÚBLICAS, Y CON FRENO
 * ---------------------
 * Las usa quien busca iglesia sin cuenta, así que no llevan sesión. Pero cada
 * llamada es una consulta de pago a Google: un contador por IP y día corta al
 * que escriba un bucle. No para a nadie decidido (la IP se falsifica); para eso
 * está la cuota diaria del proyecto en Google Cloud (`docs/google-maps.md`).
 */

/**
 * El token de sesión de Places: lo genera el teléfono al empezar a escribir
 * (`crypto.randomUUID()`). Google pide base64 seguro para URL, 36 como mucho.
 */
const TokenSesion = z.string().regex(/^[A-Za-z0-9_-]{8,36}$/, 'Sesión no válida.');

export const ConsultaSugerencias = z.object({
  q: z.string().trim().min(3, 'Escribe al menos tres letras.').max(160),
  sesion: TokenSesion,
});

export const ConsultaDetalle = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{10,300}$/, 'Ese sitio no existe.'),
  sesion: TokenSesion.optional(),
});

/** Por IP y día. Una búsqueda escrita letra a letra son unas seis sugerencias. */
const LIMITE_SUGERENCIAS = 300;
const LIMITE_DETALLES = 60;

export type Resultado<T> = { ok: true; datos: T } | { ok: false; status: number; error: string };

async function conFreno<T>(
  clave: string,
  limite: number,
  consulta: () => Promise<T>,
): Promise<Resultado<T>> {
  const freno = await checkRateLimit('ip', clave, limite);
  if (!freno.ok) {
    return { ok: false, status: 429, error: 'Demasiadas búsquedas por hoy. Prueba mañana.' };
  }
  try {
    return { ok: true, datos: await consulta() };
  } catch (error) {
    if (error instanceof LugaresSinConfigurar) {
      return { ok: false, status: 503, error: 'La búsqueda de direcciones no está disponible.' };
    }
    // Ni la consulta ni el token: solo el código de Google y la ruta.
    await captureException(error instanceof LugaresFallo ? error : new Error('Places sin respuesta'), {
      lugares: clave.split(':')[0],
    });
    return {
      ok: false,
      status: 502,
      error: 'No hemos podido buscar la dirección. Inténtalo otra vez en un momento.',
    };
  }
}

export function sugerencias(
  entrada: z.infer<typeof ConsultaSugerencias>,
  ip: string,
): Promise<Resultado<{ sugerencias: Sugerencia[] }>> {
  return conFreno(`lugares:${ip}`, LIMITE_SUGERENCIAS, async () => ({
    sugerencias: await sugerirLugares(entrada.q, entrada.sesion),
  }));
}

export function detalle(
  entrada: z.infer<typeof ConsultaDetalle>,
  ip: string,
): Promise<Resultado<{ lugar: Lugar | null }>> {
  return conFreno(`lugares-detalle:${ip}`, LIMITE_DETALLES, async () => ({
    lugar: await detalleLugar(entrada.id, entrada.sesion),
  }));
}
