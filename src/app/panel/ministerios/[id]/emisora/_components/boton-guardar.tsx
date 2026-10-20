'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

/**
 * «Guardar la radio», apagado mientras la action corre.
 *
 * El mismo patrón que el botón del catálogo de módulos. Aquí no crea nada dos
 * veces —guardar es idempotente—, pero la action tarda un par de segundos y sin
 * respuesta visible la gente vuelve a pulsar.
 */
export function BotonGuardar() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Guardando…' : 'Guardar la radio'}
    </Button>
  );
}
