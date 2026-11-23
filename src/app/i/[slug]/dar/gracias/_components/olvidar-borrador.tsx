'use client';

import { useEffect } from 'react';

import { claveBorrador } from '../../_lib/borrador';

/**
 * Borra lo que la página de dar guardó antes de ir a Stripe, ahora que el pago
 * está hecho o en camino. Sin esto, volver atrás hasta la página de dar la
 * rellenaría otra vez y diría «No se ha cobrado nada» a quien acaba de pagar.
 * No pinta nada.
 */
export function OlvidarBorrador({ slug }: { slug: string }) {
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(claveBorrador(slug));
    } catch {
      // Sin `sessionStorage` no se guardó nada.
    }
  }, [slug]);
  return null;
}
