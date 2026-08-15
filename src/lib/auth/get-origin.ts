import { headers } from 'next/headers';

/**
 * Origen absoluto real de la petición actual, leyendo las cabeceras
 * `x-forwarded-*` que pone el proxy en producción.
 *
 * Dos cosas que cuestan un rato descubrir a base de redirecciones rotas:
 *
 *   - Localhost SIEMPRE va por http. La comprobación del host va ANTES que
 *     `x-forwarded-proto` porque algunos proxies de desarrollo añaden
 *     `x-forwarded-proto: https` aunque estén sirviendo HTTP, y entonces el
 *     enlace de confirmación del correo apunta a un https que no existe.
 *
 *   - En producción, `request.url` puede llegar como `localhost:3000` si el
 *     proxy no reescribe el host. Por eso NUNCA se construye una redirección
 *     absoluta con `request.url`: se usa este helper.
 *
 * El respaldo sale de `NEXT_PUBLIC_SITE_URL` en vez de un dominio escrito a
 * mano, para que no haya que tocar código el día que Hatril tenga el suyo.
 */
export async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') || h.get('host');

  if (!host) {
    return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  }

  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return `http://${host}`;
  }

  const proto = h.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}
