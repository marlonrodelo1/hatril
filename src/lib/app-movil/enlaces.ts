/**
 * Enlaces a las fichas de la app móvil "Gonper Studio" en las tiendas.
 *
 * Están centralizados aquí para que, si algún día cambia el ID de la ficha o
 * queremos meter parámetros de campaña (UTM), se toque en UN solo sitio.
 *
 * Se pueden sobreescribir por entorno sin tocar código con:
 *   NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_STORE_URL
 */

/** App Store (iOS). ID de la ficha: 6779663501 — verificado en vivo. */
export const APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_STORE_URL ||
  'https://apps.apple.com/es/app/gonper-studio/id6779663501';

/** Google Play (Android). Package: shop.gonperstudio.app — verificado en vivo. */
export const PLAY_STORE_URL =
  process.env.NEXT_PUBLIC_PLAY_STORE_URL ||
  'https://play.google.com/store/apps/details?id=shop.gonperstudio.app';

/* -------------------------------------------------------------------------
 * App del NEGOCIO — "Gonper Socio" (`shop.gonperstudio.socio`)
 *
 * Es OTRA app: la de arriba la instala el cliente para reservar, esta la
 * instala el dueño para gestionar. No se pueden mezclar los enlaces.
 *
 * NINGUNA DE LAS DOS FICHAS ESTÁ VIVA TODAVÍA (comprobado el 2026-07-27):
 * Google Play responde 404 al package y el lookup de iTunes por bundleId
 * devuelve `resultCount: 0`. El binario está subido (Android vc8, iOS build
 * 10) pero la ficha aún no es pública, así que enlazar a ella hoy manda al
 * salón a una página de error.
 *
 * Por eso los enlaces NO tienen valor por defecto: mientras no existan, la
 * web no ofrece la descarga en ningún sitio en vez de ofrecer un 404. Cuando
 * las fichas estén publicadas se rellenan estas dos variables en Dokploy y
 * el bloque de descarga aparece solo — sin tocar código y, sobre todo, sin
 * reimprimir los flyers, que apuntan a /socio y no a la tienda.
 *
 * El ID numérico de la App Store no se puede deducir del bundleId: hay que
 * copiarlo de App Store Connect cuando la ficha salga.
 * ------------------------------------------------------------------------- */

/** Play Store de la app del dueño. Vacío = todavía no publicada. */
export const APP_SOCIO_PLAY_URL =
  process.env.NEXT_PUBLIC_APP_SOCIO_PLAY_URL || '';

/** App Store de la app del dueño. Vacío = todavía no publicada. */
export const APP_SOCIO_APP_STORE_URL =
  process.env.NEXT_PUBLIC_APP_SOCIO_APP_STORE_URL || '';

/** ¿Se puede ofrecer ya la descarga de la app del dueño? */
export const APP_SOCIO_DISPONIBLE = Boolean(
  APP_SOCIO_PLAY_URL || APP_SOCIO_APP_STORE_URL,
);
