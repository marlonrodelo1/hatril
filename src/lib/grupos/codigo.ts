import 'server-only';

import { randomInt } from 'node:crypto';

/**
 * El código del enlace de invitación de un grupo.
 *
 * Ocho caracteres de un alfabeto de 32 sin los que se confunden al dictarlos o
 * copiarlos a mano (0/O, 1/I/L): 32⁸ son más de un billón de combinaciones, y
 * `randomInt` sale de `crypto`, no de `Math.random()`. Es lo único que separa
 * a quien recibió el enlace de quien prueba códigos al azar, y lo que se ve
 * con él es poco —el nombre del grupo en `/solicitar`—, pero no tiene por qué
 * ser adivinable.
 *
 * El CHECK `ck_grupos_codigo` (0046) dice lo mismo: si este alfabeto cambia,
 * cambia allí.
 */
const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const LARGO = 8;

export function generarCodigo(): string {
  let salida = '';
  for (let i = 0; i < LARGO; i++) salida += ALFABETO[randomInt(ALFABETO.length)];
  return salida;
}

/** Lo que puede venir en la URL: en mayúsculas y sin espacios. Si no vale, null. */
export function leerCodigo(valor: string | null | undefined): string | null {
  const limpio = (valor ?? '').trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{8}$/.test(limpio) ? limpio : null;
}
