'use client';

import { useSyncExternalStore } from 'react';

/**
 * El minuto en que estamos, para la cuenta atrás de los horarios y la barra de
 * la radio.
 *
 * `useSyncExternalStore` y no un `useState` con `setInterval`: así el servidor
 * y el primer pintado del navegador usan el MISMO instante (`inicial`, el de
 * cuando se generó la página) y no hay error de hidratación, y justo después
 * React pasa solo a la hora de verdad. Importa porque la página va con ISR: el
 * primero que llega después de un rato recibe una copia hecha hace horas, y la
 * cuenta atrás de esa copia mentiría.
 *
 * Redondeado al minuto: la cuenta atrás dice «2 h 15 min», no segundos, y un
 * valor que cambia una vez por minuto repinta una vez por minuto.
 */

const UN_MINUTO = 60_000;

function minutoActual(): number {
  return Math.floor(Date.now() / UN_MINUTO) * UN_MINUTO;
}

function suscribir(avisar: () => void): () => void {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  // Al cambio de minuto y no cada 60 s desde que se abrió: si no, la cuenta
  // atrás iría hasta casi un minuto por detrás del reloj del teléfono. Se
  // vuelve a calcular cada vez porque un `setInterval` se desvía con las horas.
  const programar = () => {
    temporizador = setTimeout(
      () => {
        avisar();
        programar();
      },
      UN_MINUTO - (Date.now() % UN_MINUTO) + 50,
    );
  };
  programar();

  // El navegador congela los temporizadores de una pestaña en segundo plano:
  // quien vuelve a ella tras una hora vería la cuenta de cuando se fue.
  document.addEventListener('visibilitychange', avisar);

  return () => {
    clearTimeout(temporizador);
    document.removeEventListener('visibilitychange', avisar);
  };
}

/**
 * El minuto actual en milisegundos. Mientras se hidrata, `inicial`: el de la
 * página generada en el servidor, o `null` si quien lo usa no pinta nada con
 * la hora hasta estar en el navegador (la radio).
 */
export function useMinuto(inicial: number): number;
export function useMinuto(inicial: null): number | null;
export function useMinuto(inicial: number | null): number | null {
  return useSyncExternalStore<number | null>(suscribir, minutoActual, () => inicial);
}
