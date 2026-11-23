import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarTurnos } from '@/lib/turnos/consultas';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'turnos');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const puestos = puestosDelMinisterio(ministerio);
  const base = rutaApp(id, 'turnos');

  const [proximos, anteriores] = await Promise.all([
    listarTurnos(ctx, id, { desde: hoy, orden: 'asc', limite: 30 }),
    listarTurnos(ctx, id, { hasta: sumarDias(hoy, -1), orden: 'desc', limite: 5 }),
  ]);

  return { id, error, guardado, ctx, ministerio, hoy, puestos, base, proximos, anteriores };
}
