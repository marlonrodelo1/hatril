import 'server-only';

/**
 * El mapa de Google (Maps JavaScript API), y por qué vive en `/mapa`.
 *
 * Decidido por Marlon el 23-nov: mapa en la ficha de la iglesia y mapa con
 * pines en «cerca de mí». Lo dibuja Google en el teléfono, así que la clave
 * va en la página. Es la clave pública, `GOOGLE_MAPS_CLAVE_NAVEGADOR`, solo
 * para Maps JavaScript API y restringida por el origen de la página.
 *
 * POR QUÉ UNA PÁGINA APARTE EN UN IFRAME
 * --------------------------------------
 * La app sirve sus pantallas desde `capacitor://localhost` (iOS) y
 * `https://localhost` (Android). Google no admite bien un origen que no sea
 * http(s), y el WebView de iOS ni siquiera manda la cabecera Referer desde ese
 * esquema: una clave restringida a la app no funcionaría en el iPhone, y una
 * sin restringir se la puede llevar cualquiera.
 *
 * Así que el mapa vive en `https://hatril.com/mapa` (`src/app/mapa/route.ts`)
 * y la web y la app lo meten en un iframe. Para Google, quien pide es siempre
 * hatril.com, y la clave se restringe a hatril.com y nada más. Los datos —las
 * iglesias y, en «cerca», dónde está quien busca— le llegan al iframe por
 * `postMessage`, nunca en la dirección: la ubicación de quien busca no viaja a
 * nuestro servidor (`components/lugares/mapa-google.tsx`).
 *
 * SE CARGA AL TOCAR
 * -----------------
 * Abrir el mapa manda a Google la IP de quien mira. No se carga solo: hay que
 * tocar «Ver en el mapa», y al lado se dice que el mapa es de Google.
 *
 * LO QUE CUESTA
 * -------------
 * «Dynamic Maps»: 10.000 cargas gratis al mes y 7 $ por cada mil después
 * (precios de Google a 23-nov). Una carga es abrir el mapa, no moverlo.
 */
export function mapasConfigurados(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_CLAVE_NAVEGADOR?.trim());
}

/** Lo que reciben las pantallas de la web: dónde está el mapa, o nada. */
export function mapaWeb(): { desde: string } | null {
  return mapasConfigurados() ? { desde: '/mapa' } : null;
}
