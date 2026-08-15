/**
 * Helpers para formatear precios respetando el `precio_modo` del servicio.
 *
 *   'fijo'       → "25 €"           (precio final)
 *   'desde'      → "Desde 25 €"     (precio mínimo)
 *   'valoracion' → "Valoración previa" (sin importe)
 *
 * Si no se pasa modo, asume 'fijo' (compatible con código viejo).
 */

export type PrecioModo = 'fijo' | 'desde' | 'valoracion';

function fmtEur(n: number, opts: { decimales?: boolean } = {}): string {
  const dec = opts.decimales ?? false;
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: dec ? 2 : 0,
    maximumFractionDigits: dec ? 2 : 0,
  }).format(n);
}

/**
 * Render principal: "25 €" / "Desde 25 €" / "Valoración previa".
 * Para mostrar en cards, listas, web pública, formulario de reserva.
 */
export function formatPrecioServicio(
  precioEur: string | number | null | undefined,
  precioModo: string | null | undefined,
  opts: { decimales?: boolean } = {},
): string {
  const modo = (precioModo as PrecioModo) || 'fijo';
  if (modo === 'valoracion') return 'Valoración previa';
  const n = Number(precioEur ?? 0);
  if (!Number.isFinite(n)) return 'Valoración previa';
  const eur = fmtEur(n, opts);
  if (modo === 'desde') return `Desde ${eur}`;
  return eur;
}

/**
 * Versión corta sin prefijo "Desde" — para sitios donde el contexto
 * ya implica que es un mínimo (chips, headers de cards).
 */
export function formatPrecioBase(
  precioEur: string | number | null | undefined,
  opts: { decimales?: boolean } = {},
): string {
  const n = Number(precioEur ?? 0);
  if (!Number.isFinite(n)) return '—';
  return fmtEur(n, opts);
}

/**
 * Para emails / WhatsApp / push: si es valoración, devuelve null para
 * omitir la línea del precio. Si es 'desde' o 'fijo' devuelve el texto.
 */
export function formatPrecioMensaje(
  precioEur: string | number | null | undefined,
  precioModo: string | null | undefined,
): string | null {
  const modo = (precioModo as PrecioModo) || 'fijo';
  if (modo === 'valoracion') return null;
  const n = Number(precioEur ?? 0);
  if (!Number.isFinite(n) || n <= 0) return null;
  return formatPrecioServicio(precioEur, precioModo);
}
