import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarCanciones } from '@/lib/repertorio/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error, guardado, q, archivadas }: { id: string; error?: string; guardado?: string; q?: string; archivadas?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'repertorio');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const busqueda = q?.trim().slice(0, 80) || undefined;
  const verArchivadas = archivadas === '1';
  const canciones = await listarCanciones(ctx, id, {
    hoy,
    busqueda,
    archivadas: verArchivadas,
  });
  const base = rutaApp(id, 'repertorio');

  return { id, error, guardado, q, archivadas, ctx, ministerio, hoy, busqueda, verArchivadas, canciones, base };
}
