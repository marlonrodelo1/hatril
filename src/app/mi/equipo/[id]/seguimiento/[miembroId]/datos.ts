import 'server-only';

import { notFound } from 'next/navigation';
import { exigirUuid, requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { acompanaDe, contactosDe, personasPorFaltas } from '@/lib/seguimiento/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, miembroId, error, guardado }: { id: string; miembroId: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'seguimiento');
  exigirUuid(miembroId);

  const persona = (await personasPorFaltas(ctx, id)).find(
    (p) => p.miembroId === miembroId,
  );
  if (!persona) notFound();

  const [contactos, acompanaId] = await Promise.all([
    contactosDe(ctx, id, miembroId),
    acompanaDe(ctx, id, miembroId),
  ]);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return { id, miembroId, error, guardado, ctx, ministerio, persona, contactos, acompanaId, hoy };
}
