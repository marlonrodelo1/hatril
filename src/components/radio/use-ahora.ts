'use client';

import { useEffect, useState } from 'react';

import type { Programa } from '@/lib/emisora/config';
import {
  ahoraYLuego,
  diaDeHoy,
  type AhoraYLuego,
} from '@/lib/emisora/parrilla';

/**
 * «Ahora» y «luego», recalculados cada medio minuto.
 *
 * En el navegador y no en el servidor por dos motivos. En `/mi` el reproductor
 * vive en el layout, que no se vuelve a pintar al navegar: calculado en el
 * servidor, se quedaría con el programa de cuando se abrió la app. Y la web
 * pública se sirve con ISR, así que el servidor lo habría calculado hasta un
 * minuto antes y para todo el que llegue.
 *
 * Empieza en `null` —sin programa, se pinta el nombre de la emisora— para que
 * lo que sale del servidor y lo primero que pinta el navegador coincidan.
 */
export function useAhora(
  parrilla: Programa[],
  timezone: string,
): AhoraYLuego & { hoy: Programa['dia'] | null } {
  const [valor, setValor] = useState<
    (AhoraYLuego & { hoy: Programa['dia'] | null }) | null
  >(null);

  useEffect(() => {
    const calcular = () =>
      setValor({ ...ahoraYLuego(parrilla, timezone), hoy: diaDeHoy(timezone) });
    calcular();
    const cada = setInterval(calcular, 30_000);
    return () => clearInterval(cada);
  }, [parrilla, timezone]);

  return valor ?? { ahora: null, luego: null, hoy: null };
}
