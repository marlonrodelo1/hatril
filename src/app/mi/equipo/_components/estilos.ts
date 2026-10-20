/**
 * Las clases de los campos de la zona del líder.
 *
 * 16 PX EN EL MÓVIL, ESCRITO EN CADA CAMPO
 * ----------------------------------------
 * Safari de iOS amplía la página al enfocar un campo con la letra por debajo de
 * 16 px, y no la devuelve a su sitio al salir. `globals.css` ya lo arregla para
 * los campos sin tamaño, pero esa regla vive en `@layer base`, y la clase
 * `text-[15px]` de `Input` vive en `utilities`, que gana siempre: con el `Input`
 * tal cual, el campo sale a 15 px en un iPhone. Por eso aquí cada campo lleva
 * `max-md:text-[16px]` explícito, y `cn()` deja ese por encima del de `Input`.
 *
 * `max-md` y no 16 a secas, por lo mismo que la regla global: en escritorio no
 * pasa y la escala del sistema se respeta.
 */
export const CAMPO = 'max-md:text-[16px]';

/** Un `<select>` nativo con el aspecto de `Input`. */
export const SELECT =
  'h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-[15px] max-md:text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';

/** Un `<textarea>` con el aspecto de `Input`. */
export const AREA =
  'w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] max-md:text-[16px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';
