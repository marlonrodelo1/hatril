/**
 * Paleta de los ministerios.
 *
 * POR QUÉ UNA LISTA CERRADA Y NO UN SELECTOR DE COLOR
 * --------------------------------------------------
 * El diseño pinta cada ministerio con un par de colores: uno fuerte para el
 * punto y la barra, y su versión suave para el fondo del icono. Con un
 * selector libre, el par suave habría que calcularlo —y el resultado son
 * fondos que no pertenecen a la paleta y textos que dejan de cumplir el
 * contraste que el sistema tiene comprobado.
 *
 * Con cinco pares fijos, elegir color sigue siendo una decisión de la iglesia y
 * el resultado sigue siendo el sistema de diseño. Es la misma disciplina que la
 * regla de «un solo botón naranja por pantalla»: las restricciones son lo que
 * hace que esto se vea de una pieza.
 *
 * Los cinco pares salen literalmente de `Ministerios.dc.html`.
 */

export const COLORES_MINISTERIO = [
  { hex: '#BD4715', suave: '#F7E4DA', nombre: 'Naranja' },
  { hex: '#2F5D50', suave: '#E4EDE9', nombre: 'Verde' },
  { hex: '#B58A2B', suave: '#F6EDD9', nombre: 'Dorado' },
  { hex: '#9C3A11', suave: '#F3E0D6', nombre: 'Teja' },
  { hex: '#6B645C', suave: '#EDE8DF', nombre: 'Gris' },
] as const;

export type ColorMinisterio = (typeof COLORES_MINISTERIO)[number];

const POR_HEX = new Map(
  COLORES_MINISTERIO.map((c) => [c.hex.toLowerCase(), c]),
);

/**
 * Par de colores de un ministerio.
 *
 * Si el hex guardado no está en la paleta —porque venga de una migración vieja
 * o de una edición a mano en la base de datos— cae al gris en lugar de romper
 * la pantalla. Un ministerio con el color equivocado se ve raro; uno que revienta
 * el render se lleva por delante el listado entero.
 */
export function colorDeMinisterio(hex: string | null | undefined): ColorMinisterio {
  return POR_HEX.get((hex ?? '').toLowerCase()) ?? COLORES_MINISTERIO[4];
}
