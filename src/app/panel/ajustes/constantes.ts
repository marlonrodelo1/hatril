/**
 * Constantes de la pantalla de ajustes.
 *
 * Viven aquí y no en `actions.ts` porque un módulo con `'use server'` SOLO
 * puede exportar funciones async: cualquier otra exportación rompe el fichero
 * entero, y el error que da Turbopack —«Export X doesn't exist in target
 * module»— apunta a quien importa, no a la causa.
 */

/**
 * Cuántas filas de horario ofrece el formulario.
 *
 * Seis fijas, sin botón de «añadir». Una lista que crece necesita JavaScript, y
 * una iglesia real tiene entre dos y cinco reuniones a la semana: seis huecos
 * sobran y el formulario sigue funcionando sin JavaScript. Las filas vacías no
 * se publican.
 */
export const FILAS_HORARIO = 6;
