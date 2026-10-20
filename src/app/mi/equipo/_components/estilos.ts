/**
 * Las clases de los campos nativos de la zona de equipos, con el aspecto de
 * `Input`: 42 px de alto, el fondo y el foco del sistema.
 *
 * 16 PX EN EL MÓVIL, COMO EL `Input`
 * ----------------------------------
 * Safari de iOS amplía la página al tocar un campo de menos de 16 px y no la
 * devuelve. La regla de 16 px de `globals.css` vive en `@layer base` y pierde
 * contra cualquier clase de tamaño, así que main lo resolvió dentro de
 * `Input` con `text-[16px] md:text-[15px]` (inventario visual, M1). Un
 * `<select>` y un `<textarea>` nativos no pasan por `Input`, y aquí se escribe
 * lo mismo: 16 en el móvil y el cuerpo, 15, desde `md`.
 */

/** Un `<select>` nativo con el aspecto de `Input`. */
export const SELECT =
  'h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-[16px] md:text-body outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16';

/** Un `<textarea>` con el aspecto de `Input`. */
export const AREA =
  'w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] md:text-body leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16';
