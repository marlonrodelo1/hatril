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

/**
 * Los guards propios que lanzan los triggers, con su código en el mensaje.
 *
 * La lista se había quedado atrás: HT106 a HT109 existen en las migraciones
 * `0015` y `0017` desde agosto y no estaban aquí, así que `esGuardHatril()` no
 * se podía llamar con ellos sin que el compilador lo rechazara.
 */
export type GuardHatril =
  | 'HT101'
  | 'HT102'
  | 'HT104'
  | 'HT105'
  | 'HT106'
  | 'HT107'
  | 'HT108'
  | 'HT109'
  /** El fondo, la caja o quien registra no son de esta iglesia (`0020`). */
  | 'HT110'
  /** Un movimiento, fondo o caja no puede cambiar de iglesia (`0020`). */
  | 'HT111'
  /**
   * Alguien intentó escribir su propio plan o su `trial_until` desde una sesión
   * (`0021`). No es una fuga entre iglesias: es saltarse el muro de pago.
   */
  | 'HT112'
  /** El evento, quien lo crea o quien marca el pago no son de esta iglesia (`0024`). */
  | 'HT113'
  /** Una inscripción no cambia de evento, de iglesia ni de identidad (`0024`). */
  | 'HT114'
  /**
   * Un evento no puede cambiar de iglesia (`0024`).
   *
   * Existía en la migración y en el test de aislamiento desde agosto, y NO
   * estaba aquí — la misma deriva que ya se documentó arriba con HT106..HT109.
   * La lista se queda atrás sola: nada obliga a tocar este fichero al escribir
   * un `raise` nuevo en SQL.
   */
  | 'HT115'
  /**
   * La reunión, el ministerio, la persona o quien pasa lista no son de esta
   * iglesia (`0030`).
   */
  | 'HT116'
  /**
   * Una reunión no cambia de iglesia, y una asistencia tampoco de reunión ni de
   * persona (`0030`).
   */
  | 'HT117'
  /**
   * El ministerio, la persona acompañada o quien apunta no son de esta iglesia,
   * o quien acompaña no está en el equipo de ese ministerio (`0033`).
   */
  | 'HT118'
  /** Una asignación no cambia de iglesia ni de persona acompañada (`0033`). */
  | 'HT119'
  /**
   * Una respuesta apunta a un comentario de otra publicación, a uno que no
   * existe, o a otra respuesta (`0035`). Lo último es el tope de un solo nivel:
   * sin él, una conversación de siete niveles en un móvil de 360 px acaba en una
   * columna de cuatro caracteres de ancho.
   */
  | 'HT120'
  /** El comentario o la persona del «me gusta» no son de esta iglesia (`0035`). */
  | 'HT121';

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
