import { cache } from 'react';

/**
 * El instante actual, estable durante todo un render.
 *
 * POR QUÉ NO `Date.now()` A PELO
 * ------------------------------
 * Llamarlo dentro del cuerpo de un Server Component es una lectura impura: el
 * render deja de ser una función de sus datos, y React 19 lo marca con la regla
 * `react-hooks/purity`. No es pedantería del linter — es que el mismo render
 * puede leer dos instantes distintos.
 *
 * El caso real que esto evita: la pantalla de eventos parte la lista en
 * «próximos» y «pasados» comparando con el reloj. Con dos llamadas sueltas, un
 * evento que termina justo en ese milisegundo puede salir arriba en la primera
 * comparación y abajo en la segunda — o desaparecer de las dos.
 *
 * `cache()` de React memoriza el resultado durante la petición: todas las
 * llamadas del mismo render devuelven el mismo número, y la lectura del reloj
 * ocurre una sola vez.
 *
 * OJO: esto es el instante en UTC, para comparar `timestamptz`. Para saber qué
 * DÍA es en la iglesia hace falta su zona horaria: `hoyEnLaIglesia(timezone)`
 * en `./hoy`.
 */
export const ahoraMs = cache(() => Date.now());

/** Lo mismo como `Date`, para comparar con columnas `timestamptz`. */
export const ahoraFecha = cache(() => new Date(ahoraMs()));
