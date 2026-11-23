import 'server-only';

import { notFound } from 'next/navigation';
import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { obtenerReunion } from '@/lib/asistencia/consultas';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, reunionId, error }: { id: string; reunionId: string; error?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');
  exigirUuid(reunionId);

  const reunion = await obtenerReunion(ctx, reunionId);
  if (!reunion || reunion.ministerio?.id !== id) notFound();

  return { id, reunionId, error, ctx, ministerio, reunion };
}
