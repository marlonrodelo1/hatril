import 'server-only';

import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { guiasDeLaRed, semanasDelGrupo } from '@/lib/grupos/consultas';
import { requireGrupoEnLaApp } from '@/lib/grupos/guarda';
import { proximasSemanas } from '@/lib/grupos/semanas';
import { SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';

/**
 * Los próximos temas de una célula (`…/grupos/[grupoId]/temas`), con su
 * guarda: la misma que la pantalla de la célula. Lo usan la web y la API de la
 * app; lo guardado y las guías salen como objetos, que viajan en JSON.
 */
export async function cargar({ id, grupoId, error }: { id: string; grupoId: string; error?: string }) {
  const { ctx, grupo, ministerio } = await requireGrupoEnLaApp(id, grupoId);

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = proximasSemanas(grupo.diaSemana, hoy, SEMANAS_POR_DELANTE);
  const desde = semanas[0]!;
  const hasta = semanas[semanas.length - 1]!;

  const [guardadas, guias] = await Promise.all([
    semanasDelGrupo(ctx, grupoId, desde, hasta),
    guiasDeLaRed(ctx, id, desde, hasta),
  ]);

  return {
    id,
    grupoId,
    error,
    ctx,
    ministerio,
    grupo: { nombre: grupo.nombre, diaSemana: grupo.diaSemana },
    hoy,
    semanas,
    temas: Object.fromEntries([...guardadas].map(([s, g]) => [s, g.tema ?? ''])),
    guias: Object.fromEntries(guias),
  };
}
