import type { HorarioSemanal } from '@/lib/db/schema/iglesias';
import type { Ocurrencia } from './calendario';

/**
 * Los cultos de una iglesia, día a día, a partir de su horario semanal.
 *
 * Vivía dentro de `calendario.ts` y se sacó cuando los turnos lo necesitaron
 * para «¿en qué cultos sirve el equipo las próximas semanas?». Es la misma
 * expansión que pinta la agenda del miembro, y dos copias de «qué día cae el
 * culto del miércoles» acaban discrepando justo en el miércoles mal escrito.
 *
 * Sin `server-only` y sin base de datos: son cuentas con fechas.
 */

export type Culto = {
  /** `YYYY-MM-DD`. */
  fecha: string;
  /** `HH:MM`, o null si el horario no la tiene. */
  hora: string | null;
  titulo: string;
  detalle: string | null;
  /** El culto principal, el que la iglesia marcó para destacar en su web. */
  destacado: boolean;
};

/** Los siete días como los escribe el formulario de horarios de la iglesia. */
const DIAS = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
];

/**
 * De «Miércoles» al 0-6 de `Date.getUTCDay()`.
 *
 * Sin acentos y en minúsculas, porque el campo es de texto libre en el panel y
 * una iglesia puede haber escrito «Miercoles». Devuelve null si no se reconoce:
 * un horario mal escrito no sale en el calendario, pero no tumba la pantalla.
 */
export function diaDeLaSemana(nombre: string): number | null {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  const i = DIAS.findIndex(
    (d) => d.normalize('NFD').replace(/[̀-ͯ]/g, '') === limpio,
  );
  return i >= 0 ? i : null;
}

/** `YYYY-MM-DD` sin pasar por la zona horaria del servidor. */
export function comoFecha(d: Date): string {
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Suma días a una fecha `YYYY-MM-DD`. */
export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(fecha + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return comoFecha(d);
}

/**
 * Cada culto del horario que cae entre dos fechas, ambas incluidas.
 *
 * En el orden en que salen: por día, y dentro del día en el orden del horario.
 * Quien necesite otro orden lo pone él.
 */
export function cultosEntre(
  horarios: HorarioSemanal[],
  desde: string,
  hasta: string,
): Culto[] {
  const salida: Culto[] = [];

  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) {
    const dow = new Date(f + 'T00:00:00Z').getUTCDay();

    for (const h of horarios) {
      if (diaDeLaSemana(h.dia) !== dow) continue;
      salida.push({
        fecha: f,
        hora: h.hora || null,
        titulo: h.nombre,
        detalle: h.detalle ?? null,
        destacado: h.destacado === true,
      });
    }
  }

  return salida;
}

/**
 * Agrupa por día, que es como lo pinta el calendario. Aquí y no en
 * `./calendario` (que es solo de servidor) porque la usa también la vista de
 * la agenda que comparten la web y la app empaquetada.
 */
export function porDia(lista: Ocurrencia[]): Map<string, Ocurrencia[]> {
  const mapa = new Map<string, Ocurrencia[]>();
  for (const o of lista) {
    const dia = mapa.get(o.fecha);
    if (dia) dia.push(o);
    else mapa.set(o.fecha, [o]);
  }
  return mapa;
}

/**
 * «viernes 16, 19:30», que es como se dice un ensayo en voz alta.
 *
 * Sin el mes: dentro de la semana del turno el número del día no se confunde
 * con nada, y la línea cabe en un móvil.
 */
export function diaYHora(fecha: string, hora: string | null): string {
  // Partida a mano, como `formatearFechaLarga`: `new Date('2026-10-16')` es
  // medianoche UTC, y en un huso por detrás se pinta el día anterior.
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(a!, m! - 1, d!).toLocaleDateString('es', {
    weekday: 'long',
    day: 'numeric',
  });
  return hora ? `${dia}, ${hora}` : dia;
}
