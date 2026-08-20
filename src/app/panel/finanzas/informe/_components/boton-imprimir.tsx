'use client';

import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * `window.print()` necesita cliente, y el informe entero es un server component.
 *
 * Sale a su propio fichero en vez de marcar la página con `'use client'`: así la
 * página sigue siendo servidor y las consultas de la caja no cruzan al
 * navegador. Es la única línea de este informe que necesita JavaScript.
 */
export function BotonImprimir() {
  return (
    <Button variant="outline" onClick={() => window.print()}>
      <Printer className="size-[16px]" strokeWidth={1.8} />
      Imprimir
    </Button>
  );
}
