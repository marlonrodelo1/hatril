import 'server-only';

import { SEMANAS } from './vista';
import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { cultosParaPlanificar } from '@/lib/turnos/consultas';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error }: { id: string; error?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const cultos = await cultosParaPlanificar(
    ctx,
    id,
    hoy,
    sumarDias(hoy, SEMANAS * 7 - 1),
  );
  const pendientes = cultos.filter((c) => !c.turnoId);
  const base = rutaApp(id, 'turnos');

  return { id, error, ctx, ministerio, hoy, cultos, pendientes, base };
}
