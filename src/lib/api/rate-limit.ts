/**
 * Límite de peticiones por contador diario.
 *
 * Un `INSERT … ON CONFLICT DO UPDATE … RETURNING` sobre `rate_limits` es
 * atómico, así que varias peticiones simultáneas se suman bien sin carreras y
 * sin meter Redis en el stack. La granularidad de día basta para el abuso real
 * que nos preocupa (alguien registrando iglesias en masa); no pretende parar un
 * ataque por segundo.
 *
 * FALLA ABIERTO, Y ES DELIBERADO
 * ------------------------------
 * Si la base de datos no responde, deja pasar y marca `degraded`. Quedarse sin
 * poder registrar iglesias porque el contador está caído es peor que el abuso
 * que previene. Un endpoint que prefiera lo contrario tiene el flag para
 * decidirlo por su cuenta.
 */

import { sql } from 'drizzle-orm';

// Tabla de plataforma: RLS activada y sin policies, no se llega desde
// `hatril_app`. Además el contador tiene que funcionar ANTES de saber quién es
// quien llama — en el registro todavía no hay sesión.
import { dbAdmin } from '@/lib/db';

export type RateLimitScope = 'ip' | 'iglesia' | 'usuario';

export type RateLimitResult = {
  ok: boolean;
  actual: number;
  limite: number;
  restantes: number;
  /**
   * `true` si NO se pudo comprobar el límite y se dejó pasar por precaución.
   * Un endpoint sensible puede tratarlo como bloqueo.
   */
  degraded?: boolean;
};

export async function checkRateLimit(
  scope: RateLimitScope,
  clave: string,
  limite: number,
): Promise<RateLimitResult> {
  if (!clave) {
    return { ok: true, actual: 0, limite, restantes: limite };
  }

  try {
    const filas = await dbAdmin.execute<{ contador: number }>(sql`
      insert into rate_limits (scope, clave, dia, contador)
      values (${scope}, ${clave}, current_date, 1)
      on conflict (scope, clave, dia)
      do update set contador = rate_limits.contador + 1,
                    updated_at = now()
      returning contador
    `);

    // postgres-js devuelve el array de filas directamente; otros drivers lo
    // envuelven en `.rows`. Se cubren los dos para que un cambio de driver no
    // convierta esto en un límite que siempre da cero.
    const fila =
      (filas as unknown as { rows?: { contador: number }[] }).rows?.[0] ??
      (filas as unknown as Array<{ contador: number }>)[0];

    const actual = Number(fila?.contador ?? 0);

    return {
      ok: actual <= limite,
      actual,
      limite,
      restantes: Math.max(0, limite - actual),
    };
  } catch (err) {
    console.warn('[rate-limit] se deja pasar por error de BD:', err);
    return { ok: true, actual: 0, limite, restantes: limite, degraded: true };
  }
}

/**
 * IP del cliente, respetando las cabeceras de proxy habituales.
 *
 * `x-forwarded-for` puede traer varios saltos; el primero es el cliente real.
 * Es falsificable, así que sirve para poner freno al abuso torpe, nunca como
 * identidad.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const primero = fwd.split(',')[0]?.trim();
    if (primero) return primero;
  }

  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();

  return 'unknown';
}
