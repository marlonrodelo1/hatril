import 'server-only';

/**
 * Google Places (API New): de lo que alguien escribe a un sitio con
 * coordenadas. Decidido por Marlon el 23-nov.
 *
 * POR QUÉ GOOGLE, SI ANTES ERA OPENSTREETMAP
 * ------------------------------------------
 * Nominatim (OpenStreetMap) no encontraba direcciones colombianas: «Calle 45
 * #12-30, Bogotá» y otras dos de ese estilo daban cero resultados, y Colombia es
 * la mitad del mercado. Además sus normas prohíben sugerir mientras se escribe.
 *
 * POR QUÉ DESDE NUESTRO SERVIDOR Y NO DESDE EL TELÉFONO
 * -----------------------------------------------------
 * - La clave es secreta y va restringida a la IP del servidor. Una clave en el
 *   navegador solo se puede restringir por el origen de la página, y en el
 *   iPhone la app no manda ninguno (`capacitor://localhost`).
 * - El teléfono no habla con Google: Google no recibe la IP de quien busca ni
 *   le pone cookies, y no hace falta pedir consentimiento para esto.
 * - A cambio, la dirección escrita pasa por nuestro servidor. No se guarda: ni
 *   en la base ni en los registros (`registrarFallo` no la lleva).
 *
 * LO QUE CUESTA
 * -------------
 * Precios de Google a 23-nov (https://developers.google.com/maps/billing-and-pricing/pricing):
 * 10.000 sugerencias y 10.000 detalles gratis al mes, y luego 2,83 $ y 5 $ por
 * cada mil. Con `sessionToken`, las sugerencias de una búsqueda que acaba en un
 * detalle van en una sesión. El tope de verdad lo pone la cuota diaria del
 * proyecto en Google Cloud (`docs/google-maps.md`), no este código.
 *
 * Sin `GOOGLE_MAPS_CLAVE_SERVIDOR` todo esto contesta `LugaresSinConfigurar` y
 * las rutas lo convierten en un 503 con un mensaje para la persona.
 */

const PLACES = 'https://places.googleapis.com/v1';

/** Hatril está en España y Colombia: así «Betania» no sale en Filipinas. */
const PAISES = ['es', 'co'];

/** Lo que tarda Google como mucho antes de dar la búsqueda por fallida. */
const ESPERA_MS = 5000;

export type Sugerencia = {
  /** El `place_id` de Google. */
  id: string;
  /** «Calle 45 #12-30». */
  principal: string;
  /** «Bogotá, Colombia». */
  secundario: string | null;
};

export type Lugar = {
  id: string;
  /** La dirección entera, como la escribe Google. */
  direccion: string;
  /** El municipio, si Google lo da: para rellenar «Ciudad» en Ajustes. */
  ciudad: string | null;
  latitud: number;
  longitud: number;
};

export class LugaresSinConfigurar extends Error {
  constructor() {
    super('Falta GOOGLE_MAPS_CLAVE_SERVIDOR.');
    this.name = 'LugaresSinConfigurar';
  }
}

export class LugaresFallo extends Error {
  constructor(readonly status: number, detalle: string) {
    super(`Places ${status}: ${detalle}`);
    this.name = 'LugaresFallo';
  }
}

function clave(): string {
  const valor = process.env.GOOGLE_MAPS_CLAVE_SERVIDOR?.trim();
  if (!valor) throw new LugaresSinConfigurar();
  return valor;
}

export function lugaresConfigurados(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_CLAVE_SERVIDOR?.trim());
}

/**
 * Lo que Google contesta cuando algo va mal, sin el cuerpo entero: puede
 * traer la consulta, y la consulta es lo que escribió una persona.
 */
async function fallo(r: Response): Promise<LugaresFallo> {
  let estado = '';
  try {
    const cuerpo = (await r.json()) as { error?: { status?: string } };
    estado = cuerpo.error?.status ?? '';
  } catch {
    // Sin cuerpo legible: basta con el código.
  }
  return new LugaresFallo(r.status, estado || r.statusText);
}

/** Sugerencias mientras se escribe. `sesion` agrupa una búsqueda (ver arriba). */
export async function sugerirLugares(texto: string, sesion: string): Promise<Sugerencia[]> {
  const r = await fetch(`${PLACES}/places:autocomplete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': clave(),
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify({
      input: texto,
      sessionToken: sesion,
      languageCode: 'es',
      includedRegionCodes: PAISES,
    }),
    signal: AbortSignal.timeout(ESPERA_MS),
    cache: 'no-store',
  });
  if (!r.ok) throw await fallo(r);

  const cuerpo = (await r.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId?: string;
        structuredFormat?: {
          mainText?: { text?: string };
          secondaryText?: { text?: string };
        };
      };
    }[];
  };

  const sugerencias: Sugerencia[] = [];
  for (const s of cuerpo.suggestions ?? []) {
    const p = s.placePrediction;
    const principal = p?.structuredFormat?.mainText?.text?.trim();
    if (!p?.placeId || !principal) continue;
    sugerencias.push({
      id: p.placeId,
      principal,
      secundario: p.structuredFormat?.secondaryText?.text?.trim() || null,
    });
  }
  return sugerencias;
}

type DetalleGoogle = {
  id?: string;
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  addressComponents?: { longText?: string; types?: string[] }[];
};

async function pedirDetalle(
  id: string,
  campos: string,
  sesion?: string,
): Promise<DetalleGoogle | null> {
  const url = new URL(`${PLACES}/places/${encodeURIComponent(id)}`);
  url.searchParams.set('languageCode', 'es');
  if (sesion) url.searchParams.set('sessionToken', sesion);

  const r = await fetch(url, {
    headers: { 'X-Goog-Api-Key': clave(), 'X-Goog-FieldMask': campos },
    signal: AbortSignal.timeout(ESPERA_MS),
    cache: 'no-store',
  });
  // Un sitio que Google ya no tiene (cerró, se fusionó con otro): no es un
  // fallo nuestro, es que ese sitio no existe.
  if (r.status === 404) return null;
  if (!r.ok) throw await fallo(r);
  return (await r.json()) as DetalleGoogle;
}

function coordenadas(d: DetalleGoogle): { latitud: number; longitud: number } | null {
  const latitud = d.location?.latitude;
  const longitud = d.location?.longitude;
  if (typeof latitud !== 'number' || typeof longitud !== 'number') return null;
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) return null;
  return { latitud, longitud };
}

/**
 * El sitio que alguien eligió de las sugerencias, con sus coordenadas. Cierra
 * la sesión de `sugerirLugares`.
 *
 * Campos «Essentials» nada más: dirección, componentes y ubicación. Pedir el
 * nombre del negocio, el teléfono o las fotos lo pasaría a «Pro», que es otro
 * precio y aquí no hace falta.
 */
export async function detalleLugar(id: string, sesion?: string): Promise<Lugar | null> {
  const d = await pedirDetalle(id, 'id,formattedAddress,location,addressComponents', sesion);
  if (!d) return null;
  const c = coordenadas(d);
  if (!c) return null;

  const ciudad =
    d.addressComponents?.find((a) => a.types?.includes('locality'))?.longText?.trim() ||
    d.addressComponents
      ?.find((a) => a.types?.includes('administrative_area_level_2'))
      ?.longText?.trim() ||
    null;

  return { id: d.id ?? id, direccion: d.formattedAddress?.trim() ?? '', ciudad, ...c };
}

/** Solo las coordenadas, para el refresco mensual (`./refresco.ts`). */
export async function coordenadasDeLugar(
  id: string,
): Promise<{ latitud: number; longitud: number } | null> {
  const d = await pedirDetalle(id, 'id,location');
  return d ? coordenadas(d) : null;
}
