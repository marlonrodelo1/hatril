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
 * Los cinco `suave` salen literalmente de `Ministerios.dc.html`. Fueron tintes
 * casi negros mientras la aplicación era oscura (22-ago) y vuelven a ser los
 * pasteles del diseño con la paleta crema (15-oct).
 *
 * EL `hex` NO SE TOCA, Y `claro` YA NO ES CLARO
 * ---------------------------------------------
 * El `hex` es lo que cada iglesia tiene guardado en su fila; cambiarlo sería
 * reescribirle el color que eligió. Lo que sigue al tema son sus acompañantes.
 *
 * `claro` nació en el paso a oscuro para lo que va ENCIMA de `suave` —la
 * insignia del equipo, el título del grupo, el icono de la agenda—, porque el
 * propio `hex` no se leía sobre un fondo casi negro. En claro el problema se da
 * la vuelta y es el tono que hay que oscurecer. El nombre se queda para no
 * tocar a quien lo usa: léase «el de encima».
 *
 * Verde, Teja y Gris pasan con su `hex` tal cual. Naranja daba 4.19:1 sobre su
 * pastel y Dorado 2.72 —el mismo hueco que ya tenía el diseño original—, así
 * que bajan de luminosidad sin mover tono ni saturación. Medidos contra el peor
 * de su `suave`, #FFFFFF, #FAF9F5, #F5F4ED y #F0EEE6: 4.60, 6.28, 4.72, 5.43 y
 * 4.78.
 */

export const COLORES_MINISTERIO = [
  { hex: '#BD4715', suave: '#F7E4DA', claro: '#B24314', nombre: 'Naranja' },
  { hex: '#2F5D50', suave: '#E4EDE9', claro: '#2F5D50', nombre: 'Verde' },
  { hex: '#B58A2B', suave: '#F6EDD9', claro: '#84641F', nombre: 'Dorado' },
  { hex: '#9C3A11', suave: '#F3E0D6', claro: '#9C3A11', nombre: 'Teja' },
  { hex: '#6B645C', suave: '#EDE8DF', claro: '#6B645C', nombre: 'Gris' },
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
