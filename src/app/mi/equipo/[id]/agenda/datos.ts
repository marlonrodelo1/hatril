import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarReuniones } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const reuniones = await listarReuniones(ctx, { ministerioId: id, limite: 40 });
  const base = rutaApp(id, 'agenda');

  // Hoy va con lo próximo: es el ensayo de esta noche, el que se abre para
  // pasar lista, y tiene que estar arriba.
  const proximas = reuniones
    .filter((r) => r.fecha >= hoy)
    .sort((a, b) =>
      a.fecha === b.fecha
        ? (a.hora ?? '').localeCompare(b.hora ?? '')
        : a.fecha.localeCompare(b.fecha),
    );
  const anteriores = reuniones.filter((r) => r.fecha < hoy);

  return { id, error, guardado, ctx, ministerio, hoy, reuniones, base, proximas, anteriores };
}
