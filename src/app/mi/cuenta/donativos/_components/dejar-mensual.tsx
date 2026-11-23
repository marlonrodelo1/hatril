'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { CircleX } from 'lucide-react';

import { Hoja } from '@/components/hoja';
import { Button } from '@/components/ui/button';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { dejarMensual } from '../actions';

/**
 * «Dejarlo» y su confirmación, para una ofrenda mensual.
 *
 * Con confirmación porque no se deshace con otro toque: la suscripción se
 * cancela en Stripe y, para volver, hay que empezar otra desde «Dar». La hoja
 * es la del muro (`menu-contenido.tsx`): abajo en el móvil, centrada en el
 * ordenador, con «Cancelar» de contorno y el destructivo al lado.
 *
 * Lo único de cliente es si la hoja está abierta. El trabajo lo hace la
 * action, que vuelve a comprobar de quién es la fila.
 */
export function DejarMensual({
  id,
  cuanto,
  iglesia,
}: {
  id: string;
  /** «50,00 €». */
  cuanto: string;
  iglesia: string;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setAbierta(true)}
      >
        Dejarlo
      </Button>

      <Hoja abierta={abierta} onCambio={setAbierta} titulo="¿Dejar lo de cada mes?">
        <form action={dejarMensual} className="flex flex-col gap-4 pb-1">
          <input type="hidden" name="id" value={id} />
          <CerrarAlTerminar alTerminar={() => setAbierta(false)} />

          <div className="flex flex-col gap-2 text-pretty text-body text-muted-foreground">
            <p>
              Ya no se cobrarán los {cuanto} de cada mes para {iglesia}. Lo que
              ya has dado no cambia.
            </p>
            <p>Si quieres cambiar la cantidad, déjalo y empieza otro desde «Dar».</p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setAbierta(false)}>
              Cancelar
            </Button>
            <BotonEnviar variant="destructive" size="lg" pendiente="Dejándolo…">
              <CircleX strokeWidth={1.8} />
              Dejarlo
            </BotonEnviar>
          </div>
        </form>
      </Hoja>
    </>
  );
}

/**
 * Cierra la hoja cuando la action termina. Si vuelve con un error, la
 * pantalla lo enseña arriba y la hoja no se queda delante tapándolo: el
 * estado de un componente de cliente sobrevive a la redirección a la misma
 * página. Es el `CerrarAlTerminar` de la contraseña provisional del super admin.
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
