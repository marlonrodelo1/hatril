import * as React from 'react';
import { Input as InputPrimitive } from '@base-ui/react/input';

import { cn } from '@/lib/utils';

/**
 * Campo de texto, con las medidas del sistema de diseño: 42 px de alto, radio
 * 8, fondo `surface-alt` y texto de 15.
 *
 * Las de shadcn eran 32 px y texto de 14, y quedaban más bajas que los botones
 * de 40 con los que comparten fila en todos los formularios.
 *
 * DOS DETALLES QUE NO SON ESTÉTICOS
 * --------------------------------
 *   - El fondo es `surface-alt` (crema tostado) y no transparente. En el
 *     esquema de Claude la tarjeta es blanca y el campo baja un escalón: sin
 *     ese contraste, un campo vacío sobre una tarjeta no se distingue del fondo
 *     y no parece que se pueda escribir en él.
 *   - El texto es de 15 px y no de 14, y de 16 por debajo de `md`. Por debajo
 *     de 16 px, Safari de iOS amplía la página al enfocar el campo y no la
 *     devuelve. `globals.css` ya lo pedía para todo `input`, pero esa regla
 *     vive en la capa `base` y `text-[15px]` es una utilidad, que gana: ningún
 *     `<Input>` llegaba a 16 en el móvil. Se vio midiendo la puerta del reparto
 *     a 375 px, con `getComputedStyle`; a ojo, 15 y 16 no se distinguen.
 */
function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        'h-[42px] w-full min-w-0 rounded-lg border border-input bg-surface-alt px-3 text-[16px] transition-colors outline-none md:text-[15px]',
        'placeholder:text-muted-foreground',
        'focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16',
        'disabled:cursor-not-allowed disabled:border-disabled-border disabled:bg-disabled-bg disabled:text-disabled-text',
        'aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/15',
        'file:inline-flex file:h-8 file:border-0 file:bg-transparent file:text-[14px] file:font-medium file:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export { Input };
