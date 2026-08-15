import { headers } from 'next/headers';

/**
 * Detección server-side de si la petición viene de la app nativa (Capacitor).
 *
 * Capacitor añade el sufijo `GonperApp/<version>` al User-Agent del WebView
 * vía `android.appendUserAgent` en `capacitor.config.ts` (Bloque A). Leerlo
 * en el servidor nos permite aplicar gating fiable sin confiar en el cliente:
 *   - En la APP: el registro/login es obligatorio.
 *   - En la WEB: la reserva sigue libre (sin registro).
 *
 * No es un mecanismo de seguridad (el UA es falsificable), solo decide el
 * flujo de UX. La autorización real sigue en Supabase Auth.
 */
export async function isNativeApp(): Promise<boolean> {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  return ua.includes('GonperApp/');
}
