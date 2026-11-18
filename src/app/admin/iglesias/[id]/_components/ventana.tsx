'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';

/**
 * La ventana de confirmación de una palanca de la ficha: su botón, y al
 * pulsarlo lo que va a pasar escrito antes de confirmar.
 *
 * El formulario que lleva dentro es el de siempre: manda `id` (y lo que pida
 * cada action) a la MISMA server action de `../../actions.ts`, que sigue
 * comprobando todo y apuntando en el registro. La ventana solo pone el freno
 * delante; no decide nada que la action no vuelva a mirar.
 *
 * Lo de dentro se monta al abrir y se desmonta al cerrar (Base UI no deja el
 * contenido en el DOM con la ventana cerrada), así que la casilla marcada o el
 * atajo elegido vuelven a empezar cada vez. Es a propósito: una casilla de
 * «entiendo que se queda sin acceso» que sigue marcada de la vez anterior no
 * confirma nada.
 */
export function Ventana({
  disparador,
  accion,
  id,
  abiertaAlEntrar = false,
  children,
}: {
  /**
   * Para llegar con la ventana ya abierta: el «Ampliar» de «Necesitan algo de
   * ti», en el inicio, trae `?ampliar=1`. Solo el estado inicial; cerrarla
   * sigue siendo cerrarla.
   */
  abiertaAlEntrar?: boolean;
  /** El botón de la fila. Siempre `sm`: va junto al texto de la palanca. */
  disparador: {
    texto: string;
    icono?: ReactNode;
    variante?: 'outline' | 'destructive';
    describidoPor?: string;
  };
  accion: (formData: FormData) => void | Promise<void>;
  /** El id de la iglesia, que viaja oculto como en el formulario de antes. */
  id: string;
  children: ReactNode;
}) {
  const [abierta, setAbierta] = useState(abiertaAlEntrar);
  const cerrar = useCallback(() => setAbierta(false), []);

  return (
    <Dialog open={abierta} onOpenChange={setAbierta}>
      <DialogTrigger
        render={
          <Button
            variant={disparador.variante ?? 'outline'}
            size="sm"
            aria-describedby={disparador.describidoPor}
          />
        }
      >
        {disparador.icono}
        {disparador.texto}
      </DialogTrigger>

      {/* Sin la X de `DialogContent`: dice «Close», en inglés, y aquí ya está
          «Cancelar», Escape y pulsar fuera. */}
      <DialogContent showCloseButton={false} className="gap-0 p-5 sm:max-w-[440px]">
        <form action={accion} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <CerrarAlTerminar alTerminar={cerrar} />
          {children}
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * El título y lo que va a pasar.
 *
 * `DialogPrimitive.Title` y no el `DialogTitle` de `components/ui`: aquel
 * lleva `text-base font-medium`, que son utilidades y ganan a `t-subtitulo`
 * (vive en la capa `components`). Con el primitivo, las clases son solo estas.
 */
export function CabeceraVentana({
  icono,
  titulo,
  peligro = false,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  /** Suspender: el título en rojo, y con icono (el color solo no avisa). */
  peligro?: boolean;
  /** Lo que va a pasar. Un solo párrafo: es la descripción de la ventana. */
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <DialogPrimitive.Title
        className={clsx(
          't-subtitulo flex items-start gap-2.5 text-pretty',
          peligro ? 'text-danger' : 'text-foreground',
        )}
      >
        <span aria-hidden className="mt-px flex-none">
          {icono}
        </span>
        <span className="min-w-0 break-words">{titulo}</span>
      </DialogPrimitive.Title>
      <DialogPrimitive.Description className="text-label leading-relaxed text-pretty text-muted-foreground">
        {children}
      </DialogPrimitive.Description>
    </div>
  );
}

/**
 * «Cancelar» y el botón que confirma, que es lo único que cambia de una
 * ventana a otra. En el móvil, los dos a medias y a todo el ancho, donde llega
 * el pulgar; en escritorio, juntos a la derecha.
 */
export function PieVentana({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:justify-end">
      <DialogClose render={<Button type="button" variant="outline" />}>
        Cancelar
      </DialogClose>
      {children}
    </div>
  );
}

/**
 * Cierra la ventana cuando la action acaba.
 *
 * Las cuatro actions redirigen siempre a esta misma ficha, con `?ok=` o con
 * `?error=`, y el aviso que dice cómo ha ido sale arriba de la página: con la
 * ventana abierta encima no se vería. El envío pasa a «pendiente» al pulsar y
 * vuelve cuando la página nueva ya está pintada; ese regreso es la señal.
 *
 * Si Next llega a remontar la página entera al redirigir (su `RedirectBoundary`
 * dice que lo hace), esto no llega a correr y la ventana sale cerrada igual. Va
 * por si no: mirar la URL no bastaría, dos errores iguales seguidos dejan la
 * misma.
 */
function CerrarAlTerminar({ alTerminar }: { alTerminar: () => void }) {
  const { pending } = useFormStatus();
  const antes = useRef(false);

  useEffect(() => {
    if (antes.current && !pending) alTerminar();
    antes.current = pending;
  }, [pending, alTerminar]);

  return null;
}
