/**
 * Qué sistema operativo tiene delante el visitante. Solo se usa para elegir
 * CÓMO se intenta abrir la app (Android e iOS necesitan mecanismos distintos)
 * y a qué tienda mandar si no la tiene.
 *
 * Va aparte del componente para poder comprobarlo con User-Agents reales sin
 * levantar un navegador.
 */

export type Plataforma = 'android' | 'ios' | 'escritorio';

/**
 * `maxTouchPoints` se pasa suelto porque es la única forma de distinguir un
 * iPad de un Mac: desde iPadOS 13 el iPad se anuncia como "Macintosh" en el
 * User-Agent, y lo que los separa es que un Mac no tiene pantalla táctil.
 */
export function plataformaDesdeUserAgent(
  userAgent: string,
  maxTouchPoints = 0,
): Plataforma {
  if (/Android/i.test(userAgent)) return 'android';
  const esIpadOS = /Macintosh/.test(userAgent) && maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/i.test(userAgent) || esIpadOS) return 'ios';
  return 'escritorio';
}
