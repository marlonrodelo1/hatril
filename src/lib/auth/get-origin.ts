import { headers } from 'next/headers';

/**
 * Devuelve el origin absoluto real de la request actual
 * (https://gonperstudio.shop o http://localhost:3000), leyendo los
 * headers x-forwarded-* que setea el proxy de Easypanel/Traefik en
 * producción.
 *
 * Importante:
 *   - Localhost SIEMPRE va por http (no hay cert SSL en el dev server).
 *     El check de host se hace antes que x-forwarded-proto porque algunos
 *     proxies de dev añaden `x-forwarded-proto: https` aunque sirvan HTTP.
 *   - En producción, NextRequest.url puede llegar como `localhost:3000`
 *     si Traefik no reescribe el host, así que NUNCA usar request.url
 *     para construir redirects absolutos — usar este helper.
 */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'gonperstudio.shop';
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return `http://${host}`;
  }
  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
