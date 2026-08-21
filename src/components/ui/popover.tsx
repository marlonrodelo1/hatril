'use client';

import { Popover as PopoverPrimitive } from '@base-ui/react/popover';

import { cn } from '@/lib/utils';

/**
 * Popover de Base UI.
 *
 * POR QUÉ ESTE Y NO `dropdown-menu`
 * ---------------------------------
 * El repo ya trae `dropdown-menu.tsx`, pero un menú es una lista de acciones:
 * sus hijos son `menuitem`, se recorren con las flechas y se cierran al pulsar.
 * El panel de avisos no es eso — es contenido con su propio `<form>` por fila y
 * un pie con «ver todos». Metido en un menú, un lector de pantalla anuncia
 * «elemento de menú» sobre cada aviso y el teclado se comporta raro.
 *
 * SIN SOMBRA, A DIFERENCIA DEL DE SHADCN
 * --------------------------------------
 * El `dropdown-menu.tsx` que trae shadcn de fábrica lleva `shadow-md ring-1`.
 * El sistema de diseño de Hatril prohíbe las sombras: la profundidad se hace
 * con bordes de 1px. Aquí va borde y nada más.
 */

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent({
  align = 'end',
  alignOffset = 0,
  side = 'bottom',
  sideOffset = 6,
  className,
  ...props
}: PopoverPrimitive.Popup.Props &
  Pick<
    PopoverPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          className={cn(
            'z-50 max-h-(--available-height) origin-(--transform-origin) overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground outline-none duration-100',
            'data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95',
            'data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
            className,
          )}
          {...props}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverClose({ ...props }: PopoverPrimitive.Close.Props) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

export { Popover, PopoverTrigger, PopoverContent, PopoverClose };
