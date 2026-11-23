import 'server-only';

import { notFound } from 'next/navigation';
import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listaDelEquipo, obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, reunionId, error, guardado }: { id: string; reunionId: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');
  exigirUuid(reunionId);

  const reunion = await obtenerReunion(ctx, reunionId);
  // La guarda miró el ministerio de la URL; falta que la reunión sea de él.
  // Sin esto, el responsable de alabanza vería el ensayo de niños —y a su
  // equipo— cambiando un uuid.
  if (!reunion || reunion.ministerio?.id !== id) notFound();

  const equipo = await listaDelEquipo(ctx, reunionId, id);
  const primeraVez = reunion.marcados === 0;
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const base = rutaApp(id, 'agenda');

  return { id, reunionId, error, guardado, ctx, ministerio, reunion, equipo, primeraVez, hoy, base };
}
