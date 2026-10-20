import { sumarDias } from '@/lib/agenda/horarios';

/**
 * «Hoy», «Mañana» o «Domingo 26».
 *
 * Para las tarjetas de la portada del líder, donde una fecha larga —«domingo, 26
 * de octubre»— se come media línea de un móvil de 375 px y lo que hay que leer
 * de un vistazo es cuál de los próximos domingos es. El mes se añade solo
 * cuando no es el de hoy: «Domingo 2 nov.» al cruzar de mes, que es justo
 * cuando un número suelto confunde.
 *
 * Se parte la fecha a mano por lo mismo que `formatearFechaLarga`: `new Date`
 * con una cadena la lee como medianoche UTC y en Colombia saldría el día antes.
 */
export function diaCorto(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';

  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a!, m! - 1, d!);
  const nombre = dia.toLocaleDateString('es', { weekday: 'long' });
  const mes =
    fecha.slice(0, 7) === hoy.slice(0, 7)
      ? ''
      : ' ' + dia.toLocaleDateString('es', { month: 'short' });

  return `${nombre.charAt(0).toLocaleUpperCase('es')}${nombre.slice(1)} ${d}${mes}`;
}

/** «Domingo 26 · 10:00», o sin la hora si es de todo el día. */
export function cuandoCorto(
  fecha: string,
  hora: string | null,
  hoy: string,
): string {
  const dia = diaCorto(fecha, hoy);
  return hora ? `${dia} · ${hora.slice(0, 5)}` : dia;
}
