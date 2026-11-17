import type { Ocurrencia, TipoDeDia } from '@/lib/agenda/calendario';

/**
 * Lo que comparten la página (servidor) y el calendario (cliente).
 *
 * En un fichero sin directiva y no dentro de `calendario.tsx`: lo que exporta
 * un fichero `'use client'` llega al servidor como una referencia de cliente,
 * no como la función, y la página se quedaba en blanco al llamar a
 * `ordenarDelDia` en la vista de semana. Se vio abriendo la pantalla; ni el
 * typecheck ni el lint lo cazan.
 */

/**
 * Un color por tipo, y el mismo en los tres sitios donde sale: el punto de la
 * rejilla, la leyenda y la marca de cada fila.
 *
 * Los cuatro de la paleta en claro (zona 2 del rediseño, 17-nov). Antes el
 * culto iba en el verde de la paleta de antes y no había leyenda que dijera qué
 * era cada punto: había que abrir el día para saberlo.
 *
 * - Tu turno, en naranja: es lo único de la rejilla que te pide algo a TI, y
 *   el naranja es el color de lo que hay que hacer.
 * - Tus equipos, en el verde de las insignias de éxito, que es el único verde
 *   que queda en la paleta.
 * - Los cultos, en carbón: son la semana de siempre, el fondo sobre el que se
 *   ve lo demás, y no deben llamar más que un turno.
 * - Los eventos, en el azul secundario. Azul y naranja se separan por tono
 *   aunque se parezcan en luminosidad, también con daltonismo; con el ámbar
 *   de antes quedaban a 1.2:1 en un punto de 6 px.
 *
 * El color nunca va solo: cada fila dice qué es en su título, y la leyenda lo
 * pone por escrito.
 */
export const COLOR_DE_TIPO: Record<TipoDeDia, string> = {
  turno: 'bg-primary',
  ministerio: 'bg-badge-success-fg',
  culto: 'bg-support',
  evento: 'bg-info',
};

/** En el orden de la leyenda: lo tuyo primero, lo de la iglesia después. */
export const LEYENDA: { tipo: TipoDeDia; texto: string }[] = [
  { tipo: 'turno', texto: 'Tus turnos' },
  { tipo: 'ministerio', texto: 'Tus equipos' },
  { tipo: 'culto', texto: 'Cultos' },
  { tipo: 'evento', texto: 'Eventos' },
];

/**
 * Lo de un día, por hora, y a la misma hora lo tuyo primero.
 *
 * El turno de las 11:00 y el culto de las 11:00 son la misma mañana, pero el
 * turno es lo que se viene a mirar: la guitarra que te toca va encima del culto
 * en el que la tocas. `sort` es estable, así que el resto conserva el orden que
 * trae del servidor.
 */
export function ordenarDelDia(cosas: Ocurrencia[]): Ocurrencia[] {
  return [...cosas].sort(
    (a, b) =>
      (a.hora ?? '99:99').localeCompare(b.hora ?? '99:99') ||
      Number(b.tipo === 'turno') - Number(a.tipo === 'turno'),
  );
}
