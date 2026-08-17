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

/**
 * Cuántas fotos caben en el carrusel de la web pública.
 *
 * Vive aquí y no en `actions.ts` porque un fichero `'use server'` solo puede
 * exportar funciones async: exportar una constante desde ahí rompe el build
 * entero, y no lo caza el typecheck —es una regla de Next, no de TypeScript—,
 * así que aparece al abrir la pantalla.
 */
export const MAX_FOTOS = 6;
