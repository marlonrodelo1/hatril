import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Dominio propio de una iglesia → slug de su web pública.
 *
 * El mapeo vive en `iglesias.dominio_propio`. `src/proxy.ts` llama a
 * `resolverSlugPorDominio` para, dado el host de la petición, reescribir a
 * `/i/[slug]`.
 *
 * POR QUÉ HAY CACHÉ AQUÍ
 * ----------------------
 * Esto corre en el proxy, o sea en CADA petición que entra. Consultar la base
 * de datos cada vez añadiría una ida y vuelta a todo, incluidas las peticiones
 * que no tienen nada que ver con dominios propios. Los pares son pocos —uno por
 * iglesia que se haya traído su dominio— así que caben en memoria con un TTL
 * corto.
 *
 * Y NUNCA LANZA
 * -------------
 * Si la base de datos falla o tarda, devuelve el último caché conocido, o uno
 * vacío. Una excepción aquí no rompería una página: tumbaría el proxy, y con él
 * el sitio entero, incluidas las iglesias que no usan dominio propio.
 *
 * Se lee con el cliente admin, que va por `fetch` y no abre conexiones TCP —
 * requisito para poder usarlo desde el proxy.
 */

const TTL_MS = 60_000;

let cache: Map<string, string> | null = null;
let cacheAt = 0;

async function cargarMapa(): Promise<Map<string, string>> {
  const ahora = Date.now();
  if (cache && ahora - cacheAt < TTL_MS) return cache;

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from('iglesias')
      .select('slug, dominio_propio')
      .not('dominio_propio', 'is', null)
      .eq('activa', true);

    if (error) throw error;

    const mapa = new Map<string, string>();
    for (const fila of (data ?? []) as Array<{
      slug: string;
      dominio_propio: string | null;
    }>) {
      const dominio = fila.dominio_propio?.toLowerCase().trim();
      if (dominio && fila.slug) mapa.set(dominio, fila.slug);
    }

    cache = mapa;
    cacheAt = ahora;
    return mapa;
  } catch {
    return cache ?? new Map();
  }
}

/**
 * Si `host` es el dominio propio de una iglesia, devuelve su slug.
 *
 * Normaliza a minúsculas, descarta el puerto y acepta tanto el apex como su
 * `www.`. Lo del `www.` no es cosmético: quien apunta su dominio suele
 * configurar solo uno de los dos y luego escribe el otro en el navegador.
 */
export async function resolverSlugPorDominio(
  host: string | null | undefined,
): Promise<string | null> {
  if (!host) return null;

  const limpio = host.toLowerCase().split(':')[0]!.trim();
  const mapa = await cargarMapa();

  const directo = mapa.get(limpio);
  if (directo) return directo;

  if (limpio.startsWith('www.')) {
    const apex = mapa.get(limpio.slice(4));
    if (apex) return apex;
  }

  return null;
}
