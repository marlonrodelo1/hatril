/**
 * Las clases de los campos nativos de la zona de equipos, con el aspecto de
 * `Input`: 42 px de alto, el fondo y el foco del sistema.
 *
 * SIN TAMAÑO PARA EL MÓVIL, A PROPÓSITO
 * -------------------------------------
 * Safari de iOS amplía la página al tocar un campo de menos de 16 px. Hoy
 * pasa en toda la aplicación: la regla de 16 px de `globals.css` vive en
 * `@layer base` y pierde contra cualquier clase de tamaño (inventario visual,
 * M1). La guía pide arreglarlo en un solo sitio —sacar esa regla de la capa—
 * y no campo a campo, así que aquí solo va el tamaño de escritorio,
 * `text-body`, y los `<Input>` van sin tamaño. Cuando entre M1, todos pasan a
 * 16 a la vez.
 */

/** Un `<select>` nativo con el aspecto de `Input`. */
export const SELECT =
  'h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-body outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16';

/** Un `<textarea>` con el aspecto de `Input`. */
export const AREA =
  'w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-body leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16';
