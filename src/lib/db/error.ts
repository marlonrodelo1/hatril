/**
 * Extrae el SQLSTATE de un error de Drizzle / postgres-js.
 *
 * Drizzle envuelve los errores nativos de postgres-js en su propia clase
 * `DrizzleQueryError` que tiene la query y los params en el mensaje
 * y el error original en `.cause`. El SQLSTATE puede estar:
 *   - directamente en `err.code` (cuando postgres-js es el caller raíz)
 *   - en `err.cause.code` (cuando Drizzle envuelve)
 *
 * Devuelve el string de 5 chars (ej. '23505' = unique_violation,
 * '23P01' = exclusion_violation) o undefined si no se pudo extraer.
 *
 * Códigos relevantes en este repo:
 *   23505 — unique_violation (índices únicos: cliente teléfono, etc.)
 *   23P01 — exclusion_violation (GIST citas_no_solape_excl)
 *   23503 — foreign_key_violation
 *   23502 — not_null_violation
 *   23514 — check_violation
 */
export function pgErrorCode(err: unknown): string | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as { code?: unknown; cause?: unknown };

  if (typeof e.code === 'string') return e.code;

  if (e.cause && typeof e.cause === 'object') {
    const cc = (e.cause as { code?: unknown }).code;
    if (typeof cc === 'string') return cc;
  }

  return undefined;
}

/**
 * Helper específico para detectar violación de unique constraint
 * (incluye comprobación textual de "duplicate key value" por si el
 * driver no propaga el code en algún entorno raro).
 */
export function isUniqueViolation(err: unknown): boolean {
  if (pgErrorCode(err) === '23505') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /duplicate key value violates unique constraint/i.test(msg);
}

/** Los guards propios que lanzan los triggers, con su código en el mensaje. */
export type GuardHatril = 'HT101' | 'HT102' | 'HT104' | 'HT105';

/**
 * ¿Es este error uno de nuestros triggers guard?
 *
 * Se mira el MENSAJE y no el SQLSTATE, y no es pereza: HT101 y HT104 se lanzan
 * con `insufficient_privilege` (42501), que es también el código de un
 * `permission denied` corriente de Postgres. Traducir por SQLSTATE convertiría
 * un fallo de permisos de verdad —el síntoma exacto de que alguien cambió el rol
 * de `withUser`, que ya costó días una vez— en un mensaje tranquilizador sobre
 * ministerios.
 */
export function esGuardHatril(err: unknown, codigo: GuardHatril): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const causa =
    err && typeof err === 'object'
      ? String((err as { cause?: { message?: unknown } }).cause?.message ?? '')
      : '';
  return msg.includes(codigo) || causa.includes(codigo);
}
