/**
 * El mes de `?mes=AAAA-MM`, para el historial y el informe del reparto.
 *
 * Validado y no pasado tal cual: con `?mes=foo`, `mesEnLaIglesia` devuelve
 * `NaN-NaN-01` y Postgres falla con un 500 (le pasa al informe de finanzas).
 * Un mes que no vale cae al actual, que es lo que alguien que toca la URL
 * espera ver.
 *
 * El año va acotado a 19xx y 20xx y no a cuatro cifras cualesquiera:
 * `mesEnLaIglesia` no rellena el año con ceros, y con `?mes=0050-01` salía
 * `50-01-01`, que Postgres lee como mes 50 (otro 500), y con `0004-02` un
 * rango que abarcaba casi treinta años de repartos bajo «febrero de 1904».
 */
export function mesValido(mes: string | undefined): string | null {
  return mes && /^(19|20)\d{2}-(0[1-9]|1[0-2])$/.test(mes) ? mes : null;
}

/** `2026-10` más o menos un mes, sin `Date` para no pelearse con husos. */
export function moverMes(mes: string, delta: number): string {
  const [a, m] = mes.split('-').map(Number);
  const total = a! * 12 + (m! - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}
