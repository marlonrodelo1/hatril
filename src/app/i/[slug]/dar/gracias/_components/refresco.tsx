'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Mientras el pago sigue pendiente: volver a preguntar solo, de vez en cuando,
 * y un botón para hacerlo a mano.
 *
 * Stripe devuelve a la persona aquí a la vez que avisa al webhook, y casi
 * siempre llega antes la persona. Lo normal es que en uno o dos refrescos ya
 * esté pagado. Se para al minuto: si el banco pide confirmar en su app o el
 * webhook se retrasa, seguir preguntando cada pocos segundos no lo acelera, y
 * el botón sigue ahí.
 *
 * `router.refresh()` vuelve a pintar la página en el servidor sin recargarla
 * entera: la pantalla cambia sola de «confirmando» a «gracias».
 */
const CADA_MS = 4000;
const VECES = 15;

export function RefrescoPendiente() {
  const router = useRouter();
  const [veces, setVeces] = useState(0);
  const [refrescando, empezar] = useTransition();

  useEffect(() => {
    if (veces >= VECES) return;
    const t = setTimeout(() => {
      empezar(() => router.refresh());
      setVeces((v) => v + 1);
    }, CADA_MS);
    return () => clearTimeout(t);
  }, [veces, router]);

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      aria-busy={refrescando || undefined}
      onClick={() => empezar(() => router.refresh())}
    >
      <RefreshCw
        strokeWidth={1.8}
        aria-hidden
        className={refrescando ? 'animate-spin motion-reduce:animate-none' : undefined}
      />
      Actualizar
    </Button>
  );
}
