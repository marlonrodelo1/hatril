import { sumarDias } from '@/lib/agenda/horarios';
import type { EstadoSemanaGrupo } from '@/lib/db/schema/grupos';

/**
 * Las cuentas de semanas de un grupo, sin base de datos.
 *
 * Una semana es de lunes a domingo y se nombra por su lunes, que es lo que
 * guardan `grupo_semanas.semana` y `grupo_guias.semana` (y lo que exige su
 * CHECK). El día de la reunión es `grupos.dia_semana`, de 0 (domingo) a 6
 * (sábado), como `Date.getUTCDay()`: el domingo cae al final de su semana, no
 * al principio.
 *
 * Todas las fechas son `YYYY-MM-DD` en la zona de la iglesia (`hoyEnLaIglesia`)
 * y se suman con `sumarDias`, que no pasa por la zona del servidor.
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** «martes». */
export function nombreDelDia(dia: number): string {
  return DIAS[dia] ?? '';
}

/** El lunes de la semana de esta fecha. */
export function lunesDe(fecha: string): string {
  const dow = new Date(fecha + 'T00:00:00Z').getUTCDay();
  return sumarDias(fecha, -((dow + 6) % 7));
}

/** Qué día cae la reunión de un grupo en la semana que empieza en `semana`. */
export function fechaDeLaReunion(semana: string, diaSemana: number): string {
  return sumarDias(semana, (diaSemana + 6) % 7);
}

/**
 * La semana de la última reunión que ya tocó: la de esta semana si su día es
 * hoy o ya pasó, y si no, la de la semana anterior.
 *
 * Es la que se le pide reportar al líder y la que mira el aviso de la red. Un
 * grupo que se reúne el viernes no tiene nada pendiente de esta semana un
 * lunes: lo que le falta, si le falta, es el viernes pasado.
 */
export function semanaQueToca(diaSemana: number, hoy: string): string {
  const estaSemana = lunesDe(hoy);
  return fechaDeLaReunion(estaSemana, diaSemana) <= hoy
    ? estaSemana
    : sumarDias(estaSemana, -7);
}

/** Las `n` semanas siguientes a la que toca: las que todavía no han llegado. */
export function proximasSemanas(diaSemana: number, hoy: string, n: number): string[] {
  const base = semanaQueToca(diaSemana, hoy);
  return Array.from({ length: n }, (_, i) => sumarDias(base, 7 * (i + 1)));
}

/** Las `n` semanas desde la que toca hacia atrás, la que toca incluida. */
export function semanasAnteriores(diaSemana: number, hoy: string, n: number): string[] {
  const base = semanaQueToca(diaSemana, hoy);
  return Array.from({ length: n }, (_, i) => sumarDias(base, -7 * i));
}

/**
 * Cuántas semanas atrás se deja reportar. Ocho: el líder que vuelve de un
 * viaje puede ponerse al día, y lo de hace tres meses ya no lo va a recordar
 * nadie con cifras que valgan algo.
 */
export const SEMANAS_ATRAS_REPORTABLES = 8;

/** ¿Se puede reportar esa semana hoy? Desde hace ocho semanas hasta la actual. */
export function esSemanaReportable(semana: string, hoy: string): boolean {
  const actual = lunesDe(hoy);
  return (
    lunesDe(semana) === semana &&
    semana <= actual &&
    semana >= sumarDias(actual, -7 * SEMANAS_ATRAS_REPORTABLES)
  );
}

/** El día de un instante en la zona de la iglesia, como `hoyEnLaIglesia`. */
export function fechaEnLaIglesia(instante: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instante);
}

/**
 * En qué está la reunión que toca de un grupo.
 *
 *   - `reportada` y `no_hubo`: ya está dicho; no pide nada.
 *   - `hoy`: la reunión es hoy y todavía no se ha reportado. No es un aviso:
 *     se reporta al acabar.
 *   - `sin_reportar`: su día ya pasó y nadie dijo nada. Es lo único que avisa.
 *   - `sin_empezar`: el grupo se creó después de esa reunión, así que no se le
 *     puede pedir. Sin esto, una célula creada el miércoles saldría «sin
 *     reportar» el martes de antes de existir.
 */
export type EstadoDeLaReunion =
  | 'reportada'
  | 'no_hubo'
  | 'hoy'
  | 'sin_reportar'
  | 'sin_empezar';

export function estadoDeLaReunion(opciones: {
  diaSemana: number;
  hoy: string;
  /** El día en que se creó el grupo, en la zona de la iglesia. */
  alta: string;
  /** Lo guardado para la semana que toca, si hay algo. */
  estado: EstadoSemanaGrupo | null;
}): { semana: string; fecha: string; estado: EstadoDeLaReunion } {
  const semana = semanaQueToca(opciones.diaSemana, opciones.hoy);
  const fecha = fechaDeLaReunion(semana, opciones.diaSemana);

  let estado: EstadoDeLaReunion;
  if (opciones.estado === 'celebrada') estado = 'reportada';
  else if (opciones.estado === 'no_hubo') estado = 'no_hubo';
  else if (fecha < opciones.alta) estado = 'sin_empezar';
  else if (fecha === opciones.hoy) estado = 'hoy';
  else estado = 'sin_reportar';

  return { semana, fecha, estado };
}

/** «19:30», o null. La columna `time` llega como `19:30:00`. */
export function horaCorta(hora: string | null): string | null {
  return hora ? hora.slice(0, 5) : null;
}

/** «Martes · 19:30», o «Martes» si no tiene hora. */
export function cuandoSeReune(diaSemana: number, hora: string | null): string {
  const dia = nombreDelDia(diaSemana);
  const nombre = dia.charAt(0).toLocaleUpperCase('es') + dia.slice(1);
  const h = horaCorta(hora);
  return h ? `${nombre} · ${h}` : nombre;
}

/**
 * La próxima reunión para quien va: la de hoy si es hoy y todavía no ha
 * pasado el día, y si no, la de la semana que viene en su día.
 */
export function proximaReunion(
  diaSemana: number,
  hoy: string,
): { semana: string; fecha: string } {
  const toca = semanaQueToca(diaSemana, hoy);
  const semana = fechaDeLaReunion(toca, diaSemana) === hoy ? toca : sumarDias(toca, 7);
  return { semana, fecha: fechaDeLaReunion(semana, diaSemana) };
}

/** «19 de octubre», para nombrar una semana por su lunes. */
export function diaYMes(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a!, m! - 1, d!).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });
}
