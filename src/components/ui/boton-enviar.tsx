'use client';

import type { ComponentProps } from 'react';
import { useFormStatus } from 'react-dom';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';

/**
 * El botón que envía un formulario de server action y DICE que está enviando.
 *
 * Antes ningún botón lo decía: se podía pulsar dos veces y no se sabía si
 * había ido. `useFormStatus` lee el estado del `<form>` que lo contiene, así
 * que basta con cambiar `<Button type="submit">` por `<BotonEnviar>`.
 *
 * SIN QUE CAMBIE EL ANCHO
 * -----------------------
 * Las dos etiquetas («Guardar» y «Guardando…») van apiladas en la misma celda
 * de rejilla y se cruzan con la opacidad: el botón mide lo que la más larga y
 * no empuja nada al cambiar.
 *
 * NO SE DESHABILITA
 * -----------------
 * `disabled` lo pintaría de gris en mitad del envío, como si de pronto no se
 * pudiera; se queda de su color con `pointer-events-none` y `aria-busy`. El
 * «hecho» de después no va aquí: casi todas las actions redirigen, y lo que
 * lo dice es la pantalla de llegada (`?ok=1`).
 */
export function BotonEnviar({
  children,
  pendiente = 'Guardando…',
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, 'type'> & {
  /** Lo que dice mientras envía. */
  pendiente?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      aria-busy={pending || undefined}
      className={clsx(pending && 'pointer-events-none', className)}
      {...props}
    >
      <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
        <span
          className={clsx(
            'inline-flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none',
            pending && 'opacity-0',
          )}
        >
          {children}
        </span>
        <span
          aria-hidden={!pending}
          className={clsx(
            'inline-flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none',
            !pending && 'opacity-0',
          )}
        >
          <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current motion-reduce:animate-none" />
          {pendiente}
        </span>
      </span>
    </Button>
  );
}
