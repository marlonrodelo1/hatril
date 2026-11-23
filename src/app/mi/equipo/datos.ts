import 'server-only';

import type { ResumenDeEquipo } from './vista';
import { redirect } from 'next/navigation';
import { puedeGestionarMinisterio } from '@/lib/auth/permisos';
import { misMinisterios, obtenerMinisterio, type MiMinisterio } from '@/lib/ministerios/consultas';
import { requireMisEquipos } from '@/lib/ministerios/en-la-app/guarda';
import { tarjetasDeLaPortada, totalPendientes } from '@/lib/ministerios/en-la-app/portada';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import type { ModoEnElEquipo } from '@/lib/ministerios/en-la-app/contrato';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ error }: { error?: string }) {
  const ctx = await requireMisEquipos();

  // Sin `error`, que se perdería: un aviso que vuelve aquí tiene que leerse.
  if (ctx.ministerioIds.length === 1 && !error) {
    redirect(rutaApp(ctx.ministerioIds[0]!));
  }

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const filas = await Promise.all(
    (await misMinisterios(ctx)).map((m) => resumir(ctx, m, hoy)),
  );
  const llevo = filas.filter((f) => f?.modo === 'lider');
  const sirvo = filas.filter((f) => f?.modo === 'participante');

  return { error, ctx, hoy, llevo, sirvo };
}
async function resumir(
  ctx: UserContext,
  m: MiMinisterio,
  hoy: string,
): Promise<ResumenDeEquipo | null> {
  const ministerio = await obtenerMinisterio(ctx, m.id);
  if (!ministerio) return null;

  const modo: ModoEnElEquipo = puedeGestionarMinisterio(ctx, m.id)
    ? 'lider'
    : 'participante';
  const tarjetas = await tarjetasDeLaPortada(ctx, ministerio, hoy, modo);

  // Lo urgente primero: si solo caben dos líneas, que sean esas.
  const pendientes = tarjetas
    .flatMap((t) => t.resumen?.pendientes ?? [])
    .sort((a, b) => Number(b.urgente ?? false) - Number(a.urgente ?? false))
    .slice(0, 2)
    .map((p) => (p.detalle ? `${p.texto} · ${p.detalle}` : p.texto));

  const proximo = tarjetas.find((t) => t.resumen?.proximo)?.resumen?.proximo;

  return {
    id: m.id,
    nombre: m.nombre,
    colorHex: m.colorHex,
    modo,
    total: totalPendientes(tarjetas),
    lineas:
      pendientes.length > 0
        ? pendientes
        : proximo
          ? [proximo.texto]
          : ['Nada pendiente'],
  };
}

