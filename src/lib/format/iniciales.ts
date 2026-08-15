/**
 * Iniciales para el avatar de una persona o de una iglesia.
 *
 * Se usa cuando no hay foto, que en una congregación real es casi siempre: el
 * pastor da de alta a la gente desde una lista, no subiendo retratos.
 *
 * Detalles que parecen tonterías y no lo son:
 *
 *   - Se descartan las partículas («de», «del», «la», «los»). «María de los
 *     Ángeles» da MA, no MD, y «Iglesia de Dios» da ID, no IDD.
 *   - Con una sola palabra se cogen dos letras de ella, no una sola perdida en
 *     mitad del círculo.
 *   - Se normaliza el acento: la Á y la A comparten avatar, que es lo que
 *     espera quien mira una lista.
 *   - Si no queda nada aprovechable, devuelve «?» en vez de cadena vacía. Un
 *     círculo vacío parece un fallo de carga; una interrogación se entiende.
 */

const PARTICULAS = new Set([
  'de',
  'del',
  'la',
  'las',
  'lo',
  'los',
  'y',
  'e',
  'da',
  'do',
  'dos',
  'van',
  'von',
]);

export function iniciales(nombre: string | null | undefined): string {
  if (!nombre) return '?';

  const palabras = nombre
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter((p) => p.length > 0 && !PARTICULAS.has(p.toLowerCase()));

  if (palabras.length === 0) return '?';

  if (palabras.length === 1) {
    return palabras[0]!.slice(0, 2).toUpperCase();
  }

  return (palabras[0]![0]! + palabras[1]![0]!).toUpperCase();
}
