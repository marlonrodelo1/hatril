import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { cronograma } from '@/lib/ninos/consultas';

/**
 * El cronograma de las clases en la app del equipo: para LEERLO. Apuntar y
 * editar clases se queda en el panel, que es donde lo elabora la responsable;
 * los maestros lo consultan el domingo desde el teléfono.
 */
export async function cargar({ id }: { id: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'ninos');
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const [proximas, pasadas] = await Promise.all([
    cronograma(ctx, id, { desde: hoy }),
    cronograma(ctx, id, { hasta: hoy }),
  ]);
  return { id, ctx, ministerio, hoy, proximas, pasadas: pasadas.slice(0, 20) };
}
