'use client';

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/**
 * La hoja que sube desde abajo.
 *
 * Vivía dentro de `mi/comunidad/_components` porque allí nació, para el
 * compositor del muro. Se mudó a `components/` en cuanto la pidió también el
 * calendario de la agenda: una carpeta `_components` dentro de una ruta declara
 * que eso es privado de esa ruta, y dejó de serlo. Mover es preferible a copiar
 * —dos hojas serían dos sitios donde arreglar el mismo desbordamiento—.
 *
 * POR QUÉ NO SE USA `DialogContent` DE `components/ui`
 * ----------------------------------------------------
 * Ese está centrado en la pantalla con `top-1/2 left-1/2 -translate-*` y un
 * ancho máximo de `sm`. En un móvil, un diálogo centrado con los comentarios
 * dentro deja franjas muertas arriba y abajo y obliga a leer en el hueco del
 * medio, que es justo donde no llega el pulgar. Aquí el contenido se pega al
 * borde inferior, ocupa todo el ancho y crece hasta el 90% de la altura.
 *
 * En escritorio vuelve a ser un diálogo normal: centrado y con ancho máximo. Es
 * la misma pieza con dos formas, y no dos componentes que se copian.
 *
 * LO QUE HACE FALTA PARA QUE NO ESTORBE
 * -------------------------------------
 * - `max-h-[90dvh]` y no `90vh`: en iOS, `vh` cuenta la barra de direcciones
 *   como si no existiera, así que el último renglón queda debajo de ella.
 * - `pb-[env(safe-area-inset-bottom)]`: sin eso, en un iPhone con barra de
 *   gestos el campo de escribir queda tapado por la propia barra del sistema.
 * - `overscroll-contain`: al llegar al final de la lista de comentarios, el
 *   gesto deja de arrastrar la página de debajo. Sin esto se lee la hoja y de
 *   pronto se mueve el muro detrás.
 *
 * SIN LIBRERÍA DE ANIMACIÓN
 * -------------------------
 * El brief lo prohíbe. La subida es una animación CSS de 150 ms sobre los
 * atributos `data-open` / `data-closed` que ya expone Base UI, y respeta
 * `prefers-reduced-motion` porque está definida en `globals.css` con esa guarda.
 */
export function Hoja({
  abierta,
  onCambio,
  titulo,
  descripcion,
  children,
  pie,
}: {
  abierta: boolean;
  onCambio: (abierta: boolean) => void;
  titulo: string;
  /** Se lee en voz alta al abrir; no se pinta. */
  descripcion?: string;
  children: React.ReactNode;
  /**
   * Lo que se queda pegado abajo mientras el cuerpo se desplaza: el campo de
   * escribir un comentario, o el botón de publicar. Va fuera del área que
   * scrollea a propósito — un campo de texto que hay que ir a buscar bajando
   * hasta el final de cuarenta comentarios no lo usa nadie.
   */
  pie?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={abierta} onOpenChange={onCambio}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop
          className={cn(
            'fixed inset-0 z-40 bg-black/25 duration-150',
            'supports-backdrop-filter:backdrop-blur-[2px]',
            'data-open:animate-in data-open:fade-in-0',
            'data-closed:animate-out data-closed:fade-out-0',
          )}
        />

        <DialogPrimitive.Popup
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 flex max-h-[90dvh] flex-col',
            'rounded-t-2xl border-t border-border bg-surface outline-none',
            'duration-150 data-open:animate-in data-open:slide-in-from-bottom',
            'data-closed:animate-out data-closed:slide-out-to-bottom',
            // Escritorio: diálogo centrado de toda la vida.
            'md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-full md:max-w-[560px]',
            'md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-2xl md:border',
            'md:data-open:zoom-in-95 md:data-open:slide-in-from-bottom-0',
          )}
        >
          {/* El tirador. No hace nada al arrastrarlo —eso pediría un gesto y
              una librería— pero dice «esto se cierra hacia abajo», que es lo
              que la gente ya sabe hacer con el dedo. */}
          <span
            aria-hidden
            className="mx-auto mt-2 h-1 w-10 flex-none rounded-full bg-border md:hidden"
          />

          <header className="flex flex-none items-center gap-3 border-b border-border px-4 py-3">
            <DialogPrimitive.Title className="text-[15.5px] font-extrabold tracking-[-0.02em]">
              {titulo}
            </DialogPrimitive.Title>

            {descripcion && (
              <DialogPrimitive.Description className="sr-only">
                {descripcion}
              </DialogPrimitive.Description>
            )}

            <span className="flex-1" />

            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              <X className="size-[18px]" strokeWidth={1.9} />
            </DialogPrimitive.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
            {children}
          </div>

          {pie && (
            <div className="flex-none border-t border-border bg-surface px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
              {pie}
            </div>
          )}
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
