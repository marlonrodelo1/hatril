/**
 * Rate limiting simple usando la tabla `rate_limits`.
 *
 * Estrategia: contador diario por (scope_type, scope_key, fecha).
 * - scope_type: 'ip' | 'salon' | 'cliente' | 'dueno'
 * - scope_key: la IP, el salonId, etc.
 * - fecha: día de calendario
 *
 * Si el contador supera el límite → bloqueo. Las cuentas se reinician al
 * cambiar de día (UTC). Granularidad diaria es suficiente para abuso real
 * sin meter Redis para sub-segundo.
 */

import { sql } from 'drizzle-orm';

import { db } from '@/lib/db';

export type RateLimitScope = 'ip' | 'salon' | 'cliente' | 'dueno';

export type RateLimitResult = {
  ok: boolean;
  current: number;
  limit: number;
  remaining: number;
  /** true si NO se pudo comprobar el límite (BD degradada) y se devolvió
   *  fail-open. Endpoints sensibles pueden tratarlo como fail-closed. */
  degraded?: boolean;
};

/**
 * Incrementa el contador de mensajes para (scope_type, scope_key) en el día
 * actual y comprueba si supera el límite. Devuelve `ok: false` si rebasa.
 *
 * Usa INSERT ... ON CONFLICT DO UPDATE para atomicidad — varios requests
 * concurrentes se suman correctamente sin race conditions.
 *
 * Si la BD falla, devuelve `ok: true` (fail-open) — preferimos servir al
 * cliente que bloquearlo por un fallo nuestro.
 */
export async function checkRateLimit(
  scopeType: RateLimitScope,
  scopeKey: string,
  limit: number,
): Promise<RateLimitResult> {
  if (!scopeKey) {
    return { ok: true, current: 0, limit, remaining: limit };
  }
  try {
    const rows = await db.execute<{ mensajes_total: number }>(sql`
      INSERT INTO rate_limits (scope_type, scope_key, fecha, mensajes_total)
      VALUES (${scopeType}, ${scopeKey}, CURRENT_DATE, 1)
      ON CONFLICT (scope_type, scope_key, fecha)
      DO UPDATE SET mensajes_total = rate_limits.mensajes_total + 1
      RETURNING mensajes_total
    `);
    const current =
      Number((rows as unknown as { rows?: { mensajes_total: number }[] }).rows?.[0]?.mensajes_total ?? 0) ||
      Number(
        (rows as unknown as Array<{ mensajes_total: number }>)?.[0]
          ?.mensajes_total ?? 0,
      );
    const remaining = Math.max(0, limit - current);
    return { ok: current <= limit, current, limit, remaining };
  } catch (err) {
    console.warn('[rate-limit] fail-open por error de BD:', err);
    return { ok: true, current: 0, limit, remaining: limit, degraded: true };
  }
}

/**
 * Extrae IP del request honrando proxy headers comunes.
 * En orden: x-forwarded-for (primer hop), x-real-ip, fallback 'unknown'.
 */
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}
