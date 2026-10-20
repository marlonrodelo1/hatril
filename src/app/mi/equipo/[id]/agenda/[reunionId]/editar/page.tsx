import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { MarcoEquipo } from '../../../../_components/marco';
import { FormularioReunion } from '../../_components/formulario';
import { editarReunionDeMinisterio } from '../../actions';

export const metadata: Metadata = { title: 'Cambiar la reunión' };

/** La gemela de `/panel/ministerios/[id]/agenda/[reunionId]/editar`. */
export default async function EditarReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, reunionId } = await params;
  const { error } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');
  exigirUuid(reunionId);

  const reunion = await obtenerReunion(ctx, reunionId);
  if (!reunion || reunion.ministerio?.id !== id) notFound();

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Cambiar"
      subtitulo={`${reunion.titulo} · ${ministerio.nombre}`}
      volver={rutaApp(id, 'agenda', reunionId)}
      error={error}
    >
      <FormularioReunion
        accion={editarReunionDeMinisterio.bind(null, id, reunionId)}
        reunion={reunion}
        hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
        texto="Guardar los cambios"
      />
    </MarcoEquipo>
  );
}
