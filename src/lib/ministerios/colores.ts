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
 * Los cinco pares salían literalmente de `Ministerios.dc.html`.
 *
 * QUÉ CAMBIÓ CON EL MODO OSCURO
 * -----------------------------
 * El `hex` NO se toca: es lo que cada iglesia tiene guardado en su fila, y
 * cambiarlo sería reescribirle el color que eligió. Lo que cambia es el
 * acompañante. El `suave` era la versión pastel para el fondo del icono, y sobre
 * una tarjeta casi negra un pastel es una mancha de luz; ahora es la versión
 * tintada oscura del mismo tono.
 *
 * Y se añade `claro`, para lo que va ENCIMA de ese fondo. En el tema claro eso
 * se resolvía usando el propio `hex` —naranja fuerte sobre naranja pálido— y
 * aquí no llega: #BD4715 sobre #2E1B12 da 2.1:1. Es la misma corrección que
 * hubo que hacer con `danger` en `globals.css`.
 */

export const COLORES_MINISTERIO = [
  { hex: '#BD4715', suave: '#2E1B12', claro: '#E8905E', nombre: 'Naranja' },
  { hex: '#2F5D50', suave: '#16261F', claro: '#7CBBA6', nombre: 'Verde' },
  { hex: '#B58A2B', suave: '#2A2314', claro: '#D6A94F', nombre: 'Dorado' },
  { hex: '#9C3A11', suave: '#2B1811', claro: '#DE8055', nombre: 'Teja' },
  { hex: '#6B645C', suave: '#262626', claro: '#A6A09A', nombre: 'Gris' },
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
