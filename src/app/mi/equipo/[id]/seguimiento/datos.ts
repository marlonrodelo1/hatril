import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { personasPorFaltas } from '@/lib/seguimiento/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'seguimiento');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const personas = await personasPorFaltas(ctx, id);
  const ausentes = personas.filter((p) => p.faltasSeguidas > 0);
  const base = rutaApp(id, 'seguimiento');

  return { id, error, guardado, ctx, ministerio, hoy, personas, ausentes, base };
}
