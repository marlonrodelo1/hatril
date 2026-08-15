import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Dominios propios de salones → slug de su web pública en gonperstudio.shop.
 *
 * El mapeo vive en la columna `salones.dominio_propio` (se gestiona desde el
 * Super Admin). El `proxy` (src/proxy.ts) llama a `resolverSlugPorDominio`
 * para, dado el host de la petición, redirigir 307 a `/s/[slug]`.
 *
 * Para NO consultar la base de datos en cada request, cacheamos en memoria
 * todos los pares dominio→slug (son pocos) con un TTL corto. Si la BD falla o
 * tarda, devolvemos el último caché conocido (o vacío) — NUNCA lanzamos ni
 * tumbamos el proxy. Se lee con el cliente admin (service-role, vía fetch),
 * que es seguro en el middleware y no abre conexiones TCP por request.
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
      .from('salones')
      .select('slug, dominio_propio')
      .not('dominio_propio', 'is', null);
    if (error) throw error;
    const mapa = new Map<string, string>();
    for (const row of (data ?? []) as Array<{
      slug: string;
      dominio_propio: string | null;
    }>) {
      const dom = row.dominio_propio?.toLowerCase().trim();
      if (dom && row.slug) mapa.set(dom, row.slug);
    }
    cache = mapa;
    cacheAt = ahora;
    return mapa;
  } catch {
    // BD caída o lenta: usar el último caché conocido, o vacío. Nunca lanzar.
    return cache ?? new Map();
  }
}

/**
 * Si `host` corresponde a un dominio propio de salón, devuelve su slug.
 * Si no, devuelve `null`. Normaliza a minúsculas, descarta el puerto, y
 * acepta tanto el apex como su `www.`.
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
