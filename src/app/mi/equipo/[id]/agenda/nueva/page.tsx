import type { Metadata } from 'next';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { MarcoEquipo } from '../../../_components/marco';
import { FormularioReunion } from '../_components/formulario';
import { crearReunionDeMinisterio } from '../actions';

export const metadata: Metadata = { title: 'Apuntar en la agenda' };

/**
 * Apuntar un ensayo, una reunión o una salida del equipo.
 *
 * Existe como pantalla propia, y no plegada dentro de la lista, porque la
 * action del panel vuelve aquí con `?error=` cuando falta un campo: es la ruta
 * gemela de `/panel/ministerios/[id]/agenda/nueva` (ver `en-la-app/rutas.ts`).
 */
export default async function NuevaReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Apuntar en la agenda"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id, 'agenda')}
      error={error}
    >
      <FormularioReunion
        accion={crearReunionDeMinisterio.bind(null, id)}
        hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
        texto="Apuntar"
      />
    </MarcoEquipo>
  );
}
