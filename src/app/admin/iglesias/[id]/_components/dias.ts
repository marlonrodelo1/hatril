/**
 * Cuentas con días sueltos (`YYYY-MM-DD`), las que piden la ficha y su ventana
 * de ampliar la prueba. Sin `server-only` ni `'use client'`: las usan los dos
 * lados, y tienen que dar lo mismo en los dos.
 *
 * SIN PASAR POR NINGUNA ZONA
 * --------------------------
 * Un `YYYY-MM-DD` es un día del calendario de la iglesia, no un instante.
 * `new Date('2026-12-02')` lo lee como medianoche UTC, y pintado en el huso
 * del navegador del super admin —o del contenedor— puede salir el día de
 * antes. Aquí se trabaja con los tres números y en UTC, que no tiene saltos de
 * hora, y la zona de la iglesia solo entra donde de verdad cuenta: al cerrar
 * el día a las 23:59, que lo hace la action.
 */

const FORMATO_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;

/** ¿Es un día con la forma que espera la action? */
export function esDia(valor: string): boolean {
  return FORMATO_DIA.test(valor);
}

/** El día `n` días después (o antes, con `n` negativo). */
export function sumarDias(dia: string, n: number): string {
  const [, a, m, d] = FORMATO_DIA.exec(dia) ?? [];
  const fecha = new Date(Date.UTC(Number(a), Number(m) - 1, Number(d) + n));
  return fecha.toISOString().slice(0, 10);
}

/**
 * «2 dic 2026». El mismo formato que `fecha()` de las piezas de `/admin`, para
 * que el día que se elige en la ventana se lea igual que el de la ficha y el
 * del registro.
 */
export function formatearDia(dia: string): string {
  const [, a, m, d] = FORMATO_DIA.exec(dia) ?? [];
  return new Date(Date.UTC(Number(a), Number(m) - 1, Number(d))).toLocaleDateString(
    'es-ES',
    { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' },
  );
}
