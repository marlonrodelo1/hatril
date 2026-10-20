/**
 * El plazo de conservación del padrón: un año sin venir.
 *
 * Es lo que el aviso de la puerta promete («si pasa un año sin que vengas, lo
 * borramos»), lo que dicen `/privacidad` §6 y el anexo del art. 28, y lo que el
 * padrón ofrece borrar de una vez. Si cambia, cambian los tres textos y sube
 * `VERSION_CONSENTIMIENTO_REPARTO`: el aviso que se leyó decía otra cosa.
 *
 * Devuelve el mismo día de hace un año, como `YYYY-MM-DD`. Quien vino por
 * última vez ANTES de esa fecha lleva más de un año sin venir.
 *
 * Con los números y sin `Date`, como `formatearFechaLarga`: una cadena de fecha
 * en `new Date()` es medianoche UTC y en Bogotá cae el día anterior. El 29 de
 * febrero pasa al 28, que es el último día que existe ese mes.
 */
export function haceUnAnio(hoy: string): string {
  const [a, m, d] = hoy.split('-').map(Number);
  const anio = a! - 1;
  const ultimoDelMes = new Date(Date.UTC(anio, m!, 0)).getUTCDate();
  const dia = Math.min(d!, ultimoDelMes);
  return `${anio}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}
