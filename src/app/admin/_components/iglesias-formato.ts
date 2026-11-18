import { ZONA_ADMIN } from './piezas';

/**
 * Fechas cortas para las listas de Inicio e Iglesias: «15 nov», y con el año
 * solo cuando no es el de ahora («1 ene 2027»).
 *
 * El año se compara en la MISMA zona que se pinta: el 31 de diciembre a las
 * 23:30 en Bogotá ya es 1 de enero en Canarias, y con la comparación en otra
 * zona saldría «31 dic» sin año en un listado de enero.
 *
 * La zona por defecto es la de `/admin` (Canarias). Lo que es de UNA iglesia
 * —hasta cuándo tiene acceso— se pasa con la suya.
 */
export function fechaCorta(
  d: Date,
  timeZone: string = ZONA_ADMIN,
  ahora: Date = new Date(),
): string {
  const anio = (x: Date) =>
    x.toLocaleDateString('es-ES', { year: 'numeric', timeZone });
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    ...(anio(d) === anio(ahora) ? {} : { year: 'numeric' }),
    timeZone,
  });
}

/** «Miércoles 18 de noviembre», para el subtítulo de Inicio. */
export function hoyEnPalabras(ahora: Date = new Date()): string {
  const texto = ahora.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: ZONA_ADMIN,
  });
  // `toLocaleDateString` pone una coma tras el día de la semana en algunas
  // versiones de ICU («miércoles, 18 de noviembre»): fuera, para que la frase
  // del subtítulo no lleve dos.
  return texto.replace(',', '');
}
