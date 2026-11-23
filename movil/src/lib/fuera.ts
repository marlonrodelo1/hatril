import { WEB_URL } from './entorno';

/**
 * Abre una página de la web fuera de la app: en el navegador del teléfono.
 *
 * Para lo que no va en el binario: el panel, la política, «Dar». En iOS
 * además es obligatorio para «Dar» (norma 3.2.2: los donativos, fuera de la
 * app; ver `src/app/mi/_components/enlace-a-dar.tsx`).
 *
 * Con una ventana nueva, igual que el `target="_blank"` que usaba la web
 * dentro del WebView: Capacitor la entrega al sistema (Safari en iOS, el
 * navegador de siempre en Android) en vez de abrirla dentro. Y no un
 * navegador embebido (`@capacitor/browser`): el panel necesita la sesión de
 * la web, que vive en las cookies del navegador de siempre, y Stripe se rompe
 * dentro de una vista embebida.
 *
 * Acepta una ruta de la web (`/panel/hoy`) o una dirección completa.
 */
export function abrirFuera(destino: string): void {
  const url = /^https?:\/\//.test(destino) ? destino : `${WEB_URL}${destino}`;
  window.open(url, '_blank', 'noopener');
}
