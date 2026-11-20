import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';
import { cache } from 'react';

/**
 * `cache()` de React, que además memoiza dentro de un endpoint de la app.
 *
 * POR QUÉ NO BASTA CON `cache()` (19-nov)
 * --------------------------------------
 * `cache()` solo memoiza mientras React está renderizando. Un route handler no
 * renderiza nada, y ahí cada llamada ejecuta la función entera: medido con una
 * ruta de prueba, tres llamadas seguidas fueron tres ejecuciones.
 *
 * En una página no se nota. En la API de la app (`/api/v1/app/*`) sí: cada
 * guarda vuelve a pedir el contexto, y eso es otro `getUser()` contra Auth
 * (174 ms medidos desde Canarias) y otras tres consultas a la base por cada
 * guarda encadenada.
 *
 * `endpointApp()` abre aquí una memoria por petición, y estas funciones la
 * usan si la hay. Fuera de un endpoint de la app se comportan exactamente
 * como `cache()`.
 *
 * Solo para funciones sin argumentos: la clave es la propia función. Las que
 * llevan argumentos no se repiten dentro de una misma petición, y si un día
 * lo hacen, la clave tendrá que llevarlos.
 */
type Peticion = {
  memo: Map<object, Promise<unknown>>;
  /** Los tramos que se han medido, para la cabecera `Server-Timing`. */
  tiempos: { nombre: string; ms: number }[];
};

const memoria = new AsyncLocalStorage<Peticion>();

/** Ejecuta `fn` con una memoria propia, que muere con la petición. */
export function enUnaPeticion<T>(fn: () => Promise<T>): Promise<T> {
  return memoria.run({ memo: new Map(), tiempos: [] }, fn);
}

export function cachePorPeticion<T>(fn: () => Promise<T>): () => Promise<T> {
  const deReact = cache(fn);
  return function () {
    const peticion = memoria.getStore();
    if (!peticion) return deReact();
    let enCurso = peticion.memo.get(fn) as Promise<T> | undefined;
    if (!enCurso) {
      enCurso = fn();
      peticion.memo.set(fn, enCurso);
    }
    return enCurso;
  };
}

/**
 * Cuánto tarda un tramo de un endpoint de la app, para `Server-Timing`.
 *
 * Es la medida de la fase 0 del plan (`docs/app-nativa/plan-spa.md`): saber de
 * dónde sale el tiempo de cada pantalla antes de tocar nada. Se ve en la
 * pestaña de red del navegador y lo imprime `test:puertas:app`. Fuera de un
 * endpoint de la app no apunta nada.
 */
export async function medir<T>(nombre: string, fn: () => Promise<T>): Promise<T> {
  const peticion = memoria.getStore();
  if (!peticion) return fn();
  const inicio = performance.now();
  try {
    return await fn();
  } finally {
    peticion.tiempos.push({ nombre, ms: performance.now() - inicio });
  }
}

/** Los tramos medidos en esta petición, en el formato de `Server-Timing`. */
export function tiemposDeLaPeticion(): string[] {
  const peticion = memoria.getStore();
  if (!peticion) return [];
  return peticion.tiempos.map((t) => `${t.nombre};dur=${Math.round(t.ms)}`);
}
