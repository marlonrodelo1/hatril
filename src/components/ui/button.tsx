import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Botón, con las cinco variantes del sistema de diseño.
 *
 * Se reescribieron las medidas que trae shadcn (32 y 36 px de alto, texto de
 * 14) por las del diseño de Hatril: 40 px, radio 8, texto de 15 en semibold.
 * No es capricho de píxeles: el diseño coloca botones junto a inputs de 42 px
 * y selects de 36, y con las medidas de fábrica las filas quedan desalineadas
 * en todas las pantallas.
 *
 * DOS COSAS DEL SISTEMA QUE ESTÁN CODIFICADAS AQUÍ
 * -----------------------------------------------
 *   - El destructivo NO se rellena de rojo hasta que se pulsa. En una pantalla
 *     donde ya hay un botón naranja, dos rojizos compitiendo hacen que ninguno
 *     destaque.
 *   - No hay sombras en ninguna variante. La profundidad se hace con bordes de
 *     1px, y el `active:translate-y-px` da la sensación de pulsación sin salirse
 *     de la regla.
 *
 * Para un enlace se usa `render`, que es lo de Base UI; `asChild` es de Radix y
 * aquí no existe:
 *
 *     <Button render={<Link href="/panel/miembros/nuevo" />}>Añadir</Button>
 *
 * PENDIENTE: cada botón-enlace suelta un aviso de Base UI por consola («expected
 * a native <button> because the `nativeButton` prop is true»), y le deja a un
 * `<a>` la semántica de botón, que es lo que anuncia un lector de pantalla. El
 * propio aviso sugiere `nativeButton={false}`. Se intentó y no se pudo comprobar
 * si surtía efecto: el navegador de las herramientas devuelve el historial de
 * avisos de toda la sesión, así que no se distingue uno nuevo de uno viejo. Se
 * dejó sin tocar antes que dar por arreglado algo sin verlo funcionar.
 * Comprobar en un Chrome de verdad, con la consola limpia y una sola página.
 */
const buttonVariants = cva(
  "group/button inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg border border-transparent font-semibold whitespace-nowrap no-underline transition-colors outline-none select-none hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/20 active:translate-y-px disabled:pointer-events-none disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-[18px]",
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground hover:bg-accent-hover active:bg-[#83300E] disabled:bg-[#E6DDD2] disabled:text-[#9A9188]',
        secondary:
          'bg-support text-white hover:bg-support-hover active:bg-[#1E3B33] disabled:bg-[#E6DDD2] disabled:text-[#9A9188]',
        outline:
          'border-border bg-surface-alt text-foreground hover:bg-background active:bg-[#E5DFD4] disabled:border-[#E9E3DA] disabled:bg-[#FBF9F5] disabled:text-[#A79E93]',
        ghost:
          'bg-transparent text-primary hover:bg-accent active:bg-[#F0D6C8] disabled:text-[#A79E93]',
        // Contorno en reposo, relleno solo al pulsar. Y siempre con icono: el
        // color por sí solo no avisa a quien no lo distingue.
        destructive:
          'border-[#E0C4C2] bg-surface-alt text-danger hover:bg-[#F7ECEB] active:border-danger active:bg-danger active:text-white disabled:border-[#E9E3DA] disabled:bg-[#FBF9F5] disabled:text-[#A79E93]',
        link: 'text-primary underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-10 px-[18px] text-[15px]',
        sm: 'h-9 px-3.5 text-[13.5px]',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-10',
        'icon-sm': 'size-[34px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

function Button({
  className,
  variant = 'default',
  size = 'default',
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
