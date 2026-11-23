import 'server-only';

import { ROL } from './vista';
import { esPastor } from '@/lib/auth/permisos';
import { requireMiEquipo } from '@/lib/ministerios/en-la-app/guarda';
import { tarjetasDeLaPortada, totalPendientes } from '@/lib/ministerios/en-la-app/portada';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error }: { id: string; error?: string }) {
  const { ctx, ministerio, modo } = await requireMiEquipo(id);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const tarjetas = await tarjetasDeLaPortada(ctx, ministerio, hoy, modo);
  const total = totalPendientes(tarjetas);

  const yo = ministerio.equipo.find((p) => p.miembroId === ctx.miembroId);
  // Del voluntario se dice lo que HACE —«Voz y teclado»— si lo tiene
  // apuntado, que es más suyo que «Voluntario». Quien no está en el equipo
  // solo llega aquí por gestionar ministerios: si es pastor, se dice; si lo
  // tiene por permiso, no se le inventa un cargo.
  const comoQue = yo
    ? yo.rolEquipo === 'voluntario'
      ? (yo.rolEnMinisterio ?? ROL.voluntario)
      : ROL[yo.rolEquipo]
    : esPastor(ctx)
      ? 'Pastor'
      : null;

  // La flecha solo si hay a dónde volver: con un solo equipo, esta ES la
  // pestaña, y volver a la lista rebotaría aquí mismo. Sin flecha, el logo,
  // como en la raíz de cualquier pestaña.
  const varios = ctx.ministerioIds.length > 1;

  return { error, ctx, ministerio, modo, tarjetas, total, comoQue, varios };
}
