/**
 * Deep links a la app del CLIENTE ("Gonper Studio") — abrir un salón concreto
 * dentro de la app en vez de en el navegador.
 *
 * El problema que resuelve: desde la web no hay forma de saber si el móvil
 * tiene la app instalada. Ningún navegador lo permite (sería un agujero de
 * privacidad). Así que se INTENTA abrir la app y, si no responde, se manda a
 * la tienda. Toda esa lógica vive en /abrir/[slug]; aquí solo se construyen
 * las URLs, en un único sitio, para que web, emails y flyers no se
 * desincronicen.
 *
 * Cómo llega cada plataforma al salón:
 *
 *   Android  intent://…;S.browser_fallback_url=<Play>;end
 *            Chrome abre la app si está instalada y, si no, va a Play él solo
 *            — sin temporizadores ni diálogos de error.
 *
 *   iOS      shop.gonperstudio.app://s/<slug> + temporizador de rescate.
 *            Safari no avisa de si el esquema existe, así que se mide si la
 *            página se queda en primer plano: si sigue visible, no había app.
 *
 * IMPORTANTE (versión de la app): la ruta interna es la MISMA que la de la
 * web (/s/<slug>), pero la app solo sabe seguirla desde la versión que maneja
 * deep links de contenido (repo gonper-app, src/lib/deep-links.js). Con
 * versiones anteriores el enlace abre la app igualmente, pero aterriza en el
 * marketplace en vez de en el salón.
 */

/**
 * ¿Se ofrece ya el botón "Abrir en la app"?
 *
 * ENCENDIDO por defecto. Se apaga poniendo NEXT_PUBLIC_DEEP_LINKS_ACTIVOS=0.
 *
 * Nació apagado por un problema de calendario: la app que había en las tiendas
 * registra el esquema `shop.gonperstudio.app://` (lo usa para volver del login
 * con Google) pero no sabe seguir el enlace hasta el salón. O sea que el deep
 * link resuelve —la app se abre— y el usuario aterriza en una pantalla
 * cualquiera, sin que salte el respaldo a la tienda, porque para el sistema
 * todo fue bien.
 *
 * Se enciende igualmente (03-08-2026, decisión de Marlon) porque la versión
 * 1.5 ya está en revisión en las dos tiendas y la base instalada es todavía
 * minúscula: a quien tenga la versión anterior le abrirá la app por la home
 * durante unos días, que es peor que el destino nuevo pero no peor que el
 * badge de tienda que había antes. A cambio, el botón se ve desde ya.
 */
export const DEEP_LINKS_ACTIVOS =
  process.env.NEXT_PUBLIC_DEEP_LINKS_ACTIVOS !== '0' &&
  process.env.NEXT_PUBLIC_DEEP_LINKS_ACTIVOS !== 'false';

/** Esquema propio que la app registra (Android: intent-filter; iOS: CFBundleURLSchemes). */
export const APP_ESQUEMA = 'shop.gonperstudio.app';

/** Package de Android — necesario para que el `intent://` apunte a NUESTRA app. */
export const APP_PACKAGE_ANDROID = 'shop.gonperstudio.app';

/**
 * ¿El slug es seguro para incrustarlo en una URL de esquema o en un `intent://`?
 *
 * Los slugs los genera `slugify()` en el alta del salón: solo [a-z0-9-]. Se
 * valida igualmente porque en un `intent://` los caracteres `;` y `#` son
 * separadores de la propia sintaxis: un slug con basura no rompería solo el
 * enlace, permitiría inyectar parámetros del intent.
 */
export function slugSeguro(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{0,78}$/.test(slug);
}

/** Ruta interna del salón dentro de la app (idéntica a la de la web). */
export function rutaSalonEnApp(slug: string): string {
  return `/s/${slug}`;
}

/** URL de la página puente que decide entre abrir la app y llevar a la tienda. */
export function enlaceAbrirEnApp(slug: string): string {
  return `/abrir/${slug}`;
}

/** Deep link por esquema propio: `shop.gonperstudio.app://s/mi-salon`. */
export function deepLinkSalon(slug: string): string {
  return `${APP_ESQUEMA}:/${rutaSalonEnApp(slug)}`;
}

/**
 * URL `intent://` de Android con fallback a Google Play.
 *
 * Formato (documentado por Chrome):
 *   intent://<host/path>#Intent;scheme=<esquema>;package=<package>;S.browser_fallback_url=<url>;end
 *
 * `browser_fallback_url` va URL-encoded porque contiene `:` y `/`, que en el
 * bloque `#Intent;…` cortarían la cadena.
 */
export function intentAndroidSalon(slug: string, urlTienda: string): string {
  return [
    `intent://s/${slug}#Intent`,
    `scheme=${APP_ESQUEMA}`,
    `package=${APP_PACKAGE_ANDROID}`,
    `S.browser_fallback_url=${encodeURIComponent(urlTienda)}`,
    'end',
  ].join(';');
}
