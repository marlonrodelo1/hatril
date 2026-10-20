/**
 * Las fechas del reparto: el plazo de conservación del padrón y la ventana del
 * aviso de la semana.
 *
 * Todas con `Date.UTC` sobre los tres números, como `formatearFechaLarga`: una
 * cadena de fecha en `new Date()` es medianoche UTC y en Bogotá cae el día
 * anterior.
 */

/**
 * El plazo de conservación del padrón: un año sin venir.
 *
 * Es lo que el aviso de la puerta promete («si pasa un año sin que vengas, lo
 * borramos»), lo que dicen `/privacidad` §6 y el anexo del art. 28, y lo que el
 * padrón ofrece borrar de una vez. Si cambia, cambian los tres textos y sube
 * `VERSION_CONSENTIMIENTO_REPARTO`: el aviso que se leyó decía otra cosa.
 *
 * Devuelve el mismo día de hace un año, como `YYYY-MM-DD`. Quien vino por
 * última vez ANTES de esa fecha lleva más de un año sin venir. El 29 de
 * febrero pasa al 28, que es el último día que existe ese mes.
 */
export function haceUnAnio(hoy: string): string {
  const [a, m, d] = hoy.split('-').map(Number);
  const anio = a! - 1;
  const ultimoDelMes = new Date(Date.UTC(anio, m!, 0)).getUTCDate();
  const dia = Math.min(d!, ultimoDelMes);
  return `${anio}-${String(m).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

/**
 * La ventana del aviso «ya vino esta semana»: de hace seis días a ayer, ambos
 * incluidos.
 *
 * Seis y no siete a propósito. Casi todas las iglesias reparten un día fijo a
 * la semana, y con siete el domingo pasado entraría en la ventana: el aviso
 * saltaría con TODA familia que viene cada domingo, que es justo lo normal, y a
 * la tercera semana nadie lo leería. Con seis avisa de lo que sí es raro —una
 * segunda vez entre semana— y calla lo de siempre. Hoy no cuenta: dos entregas
 * el mismo día ya las impide la base.
 */
export function ventanaDeLaSemana(hoy: string): { desde: string; hasta: string } {
  const [a, m, d] = hoy.split('-').map(Number);
  const dia = (delta: number) =>
    new Date(Date.UTC(a!, m! - 1, d! + delta)).toISOString().slice(0, 10);
  return { desde: dia(-6), hasta: dia(-1) };
}

/** Días enteros de `antes` a `despues`, dos fechas `YYYY-MM-DD`. */
export function diasEntre(antes: string, despues: string): number {
  const utc = (f: string) => {
    const [a, m, d] = f.split('-').map(Number);
    return Date.UTC(a!, m! - 1, d!);
  };
  return Math.round((utc(despues) - utc(antes)) / 86_400_000);
}

/** «ayer» o «hace 3 días», para la insignia del aviso de la semana. */
export function haceCuanto(fecha: string, hoy: string): string {
  const n = diasEntre(fecha, hoy);
  return n === 1 ? 'ayer' : `hace ${n} días`;
}
