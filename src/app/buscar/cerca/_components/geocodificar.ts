/**
 * Una dirección escrita → coordenadas, con Nominatim (OpenStreetMap).
 *
 * POR QUÉ NOMINATIM Y POR QUÉ DESDE EL TELÉFONO
 * --------------------------------------------
 * Decidido por Marlon el 19-nov: OpenStreetMap para empezar, para no pagar la
 * API de Google. Nominatim es gratis con sus normas
 * (https://operations.osmfoundation.org/policies/nominatim/): una petición
 * por segundo como mucho, identificarse, y nada de autocompletar mientras se
 * escribe. Por eso se llama solo al pulsar «Buscar», una vez.
 *
 * Se llama desde el navegador y no desde nuestro servidor para que la promesa
 * de `cerca-de-mi.tsx` siga siendo verdad: el servidor de Hatril no recibe la
 * dirección. La recibe OpenStreetMap, y la pantalla lo dice al lado del campo.
 * El navegador se identifica solo con la cabecera `Referer` (hatril.com), que
 * es lo que Nominatim pide a las aplicaciones web.
 *
 * Si un día el volumen pasa de lo razonable para el servidor público, el
 * cambio es la dirección de abajo: hay Nominatim de pago por uso y se puede
 * montar uno propio.
 */

export type Lugar = { lat: number; lng: number; nombre: string };

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

export async function geocodificar(direccion: string): Promise<Lugar | null> {
  const url = new URL(NOMINATIM);
  url.searchParams.set('q', direccion);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '1');
  // Hatril está en España y Colombia: así «Betania» no sale en Filipinas.
  url.searchParams.set('countrycodes', 'es,co');
  url.searchParams.set('accept-language', 'es');

  const r = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`Nominatim ${r.status}`);

  const [primero] = (await r.json()) as { lat: string; lon: string; display_name: string }[];
  if (!primero) return null;

  const lat = Number(primero.lat);
  const lng = Number(primero.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  // «Calle Mayor, 3, Centro, Madrid, Comunidad de Madrid, 28013, España» →
  // las tres primeras partes, que es lo que reconoce quien la escribió.
  const nombre = primero.display_name.split(',').slice(0, 3).join(',').trim();
  return { lat, lng, nombre };
}
