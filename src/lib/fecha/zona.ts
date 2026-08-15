/**
 * Conversión de fecha y hora locales de un salón a un instante UTC.
 *
 * Estaban dentro de `src/app/panel/citas/actions.ts`, donde solo podía usarlas
 * esa Server Action. Al salir aquí las comparten el panel web y los endpoints
 * de la app móvil, que es lo que evita que las dos superficies interpreten la
 * misma hora de forma distinta.
 *
 * Sin librerías externas: se formatea el instante en la zona objetivo con Intl
 * y se calcula el desfase. Funciona con cambios de hora de verano porque el
 * desfase se recalcula para cada fecha concreta.
 */

/**
 * Convierte una fecha local (`YYYY-MM-DD`) y una hora (`HH:MM`) de una zona
 * IANA al instante UTC que les corresponde.
 */
export function fechaLocalATimestamp(
  fechaIso: string,
  horaHHMM: string,
  timezone: string,
): Date {
  const baseUtc = new Date(`${fechaIso}T${horaHHMM}:00Z`);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(baseUtc).reduce<Record<string, string>>(
    (acc, p) => {
      if (p.type !== 'literal') acc[p.type] = p.value;
      return acc;
    },
    {},
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '00' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  const diff = asUtc - baseUtc.getTime();
  return new Date(baseUtc.getTime() - diff);
}

/**
 * Parsea el valor de un `<input type="datetime-local">` (`YYYY-MM-DDTHH:mm`)
 * interpretándolo en la zona del salón. Devuelve null si el formato no encaja.
 *
 * Se asume que quien reserva mira el calendario del salón, no el de su propio
 * huso: la hora que escribe es la hora del salón.
 */
export function parseInicioInput(
  raw: string,
  timezone: string,
): Date | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(raw);
  if (!m) return null;
  return fechaLocalATimestamp(m[1], m[2], timezone);
}
