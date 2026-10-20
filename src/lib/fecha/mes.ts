import { z } from 'zod';

import { hoyEnLaIglesia, mesEnLaIglesia } from './hoy';

/**
 * El mes que pide una URL (`?mes=2026-09`), ya validado, con sus vecinos.
 *
 * `mesEnLaIglesia` confía en lo que recibe: con `?mes=hola` calcula un
 * `NaN-NaN-01` y Postgres revienta con un 500 (`ESTADO.md`, «Parámetros de la
 * URL que tumban la página»). Aquí pasa antes por Zod, y lo que no es un mes
 * —o es uno que todavía no ha llegado— cae al mes en curso de la iglesia.
 *
 * `siguiente` es `null` en el mes en curso: no hay nada que ver en el futuro, y
 * un enlace que lleva a una pantalla vacía parece un fallo.
 */
const Mes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

export function mesPedido(
  timezone: string,
  valor: string | undefined,
): {
  mes: string;
  desde: string;
  hasta: string;
  etiqueta: string;
  anterior: string;
  siguiente: string | null;
} {
  const actual = hoyEnLaIglesia(timezone).slice(0, 7);
  const leido = Mes.safeParse(valor);
  const mes = leido.success && leido.data <= actual ? leido.data : actual;

  return {
    mes,
    ...mesEnLaIglesia(timezone, mes),
    anterior: desplazar(mes, -1),
    siguiente: mes < actual ? desplazar(mes, 1) : null,
  };
}

/** `2026-01` y -1 → `2025-12`. Con números, sin `Date`, para no tocar husos. */
function desplazar(mes: string, meses: number): string {
  const [anio, m] = mes.split('-').map(Number);
  const total = anio! * 12 + (m! - 1) + meses;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
