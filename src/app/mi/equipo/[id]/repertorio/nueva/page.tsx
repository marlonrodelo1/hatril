import type { Metadata } from 'next';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { MarcoEquipo } from '../../../_components/marco';
import { FormularioCancion } from '../_components/formulario';
import { crearCancion } from '../actions';

export const metadata: Metadata = { title: 'Apuntar una canción' };

/** La gemela de `/panel/ministerios/[id]/repertorio/nueva`. */
export default async function NuevaCancionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'repertorio');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Apuntar una canción"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'repertorio')}
      error={error}
    >
      <FormularioCancion accion={crearCancion.bind(null, id)} texto="Apuntarla" />
    </MarcoEquipo>
  );
}
