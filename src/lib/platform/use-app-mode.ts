'use client';

import { useSyncExternalStore } from 'react';
import { isNativePlatform } from './native-client';

/**
 * ¿Estamos en «modo app»? (WebView de Capacitor, o la cookie `app_shell=1` que
 * sirve para previsualizarlo en el navegador sin compilar nada).
 *
 * POR QUÉ `useSyncExternalStore` Y NO `useEffect` + `useState`
 * ------------------------------------------------------------
 * El valor no se puede calcular en el servidor —depende del User-Agent y de una
 * cookie del navegador—, así que el primer render tiene que decir `false` y
 * corregirse en el cliente. La forma clásica de hacerlo es un `useEffect` que
 * llama a `setState`, y funciona, pero provoca un render en cascada y el linter
 * de React 19 lo señala con razón.
 *
 * `useSyncExternalStore` está hecho exactamente para esto: se le da una
 * instantánea para el servidor y otra para el cliente, y React se encarga de
 * hidratar con la primera y corregir con la segunda sin re-render extra.
 *
 * La suscripción no hace nada porque el valor no cambia en toda la vida de la
 * página: o estás dentro de la app o no. Devolver una función de baja vacía es
 * el uso correcto, no un atajo.
 */

function suscribir(): () => void {
  return () => {};
}

function leerEnCliente(): boolean {
  const cookie = document.cookie
    .split('; ')
    .some((c) => c === 'app_shell=1');

  return isNativePlatform() || cookie;
}

function leerEnServidor(): boolean {
  return false;
}

export function useIsAppMode(): boolean {
  return useSyncExternalStore(suscribir, leerEnCliente, leerEnServidor);
}
