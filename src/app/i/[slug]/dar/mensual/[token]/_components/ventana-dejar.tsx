'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Dialog as DialogPrimitive } from '@base-ui/react/dialog';
import { Ban } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';

/**
 * «Dejarlo», con lo que va a pasar escrito antes de confirmar.
 *
 * La forma es la de las ventanas de la ficha del super admin
 * (`admin/iglesias/[id]/_components/ventana.tsx`): título con icono, una
 * frase, y «Cancelar» y el botón que confirma, a medias en el móvil. Sin la X
 * de `DialogContent`, que dice «Close» en inglés; ya están «Cancelar», Escape y
 * pulsar fuera.
 *
 * Es un botón destructivo y no naranja: dejar de dar no es lo que se viene a
 * hacer a esta pantalla con alegría, y el rojo de contorno con su icono avisa
 * sin gritar (se rellena solo al pulsar).
 */
export function VentanaDejar({
  accion,
  iglesiaNombre,
  total,
}: {
  accion: () => Promise<void>;
  iglesiaNombre: string;
  /** «60,00 €», ya formateado. */
  total: string;
}) {
  const [abierta, setAbierta] = useState(false);
  const cerrar = useCallback(() => setAbierta(false), []);

  return (
    <Dialog open={abierta} onOpenChange={setAbierta}>
      <DialogTrigger render={<Button variant="destructive" className="self-start" />}>
        <Ban strokeWidth={1.8} />
        Dejarlo
      </DialogTrigger>

      <DialogContent showCloseButton={false} className="gap-0 p-5 sm:max-w-[440px]">
        <form action={accion} className="flex flex-col gap-4">
          <CerrarAlTerminar alTerminar={cerrar} />
          <div className="flex flex-col gap-2">
            {/* El primitivo y no el `DialogTitle` de `components/ui`: aquel
                trae `text-base font-medium`, que ganaría a `t-subtitulo`. */}
            <DialogPrimitive.Title className="t-subtitulo flex items-start gap-2.5 text-pretty text-danger">
              <Ban aria-hidden className="mt-px size-[18px] flex-none" strokeWidth={1.8} />
              <span className="min-w-0">Dejar de dar cada mes a {iglesiaNombre}</span>
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="text-label leading-relaxed text-pretty text-muted-foreground">
              Se cancela en Stripe y no se te cobra nada más: los {total} de cada
              mes dejan de llegar a la iglesia. Lo que ya has dado no cambia.
            </DialogPrimitive.Description>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 sm:flex sm:justify-end">
            <DialogClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </DialogClose>
            <BotonEnviar variant="destructive" pendiente="Dejándolo…">
              <Ban strokeWidth={1.8} />
              Dejarlo
            </BotonEnviar>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Cierra la ventana cuando la action acaba. La action redirige siempre a esta
 * misma página, con `?hecho=1` o con `?error=`, y el aviso sale arriba: con la
 * ventana abierta encima no se vería. El mismo truco que en la ficha del super
 * admin: el envío pasa a «pendiente» al pulsar y vuelve cuando la página nueva
 * ya está pintada.
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
