import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { FormularioReunion } from '../../_components/formulario';
import { editarReunion } from '../../actions';

export const metadata: Metadata = { title: 'Editar reunión' };

export default async function EditarReunionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  // `params` antes del guard: sin el id no hay a qué volver si rebota.
  const { id } = await params;
  // La guarda entera, también aquí: el layout no protege la página (CLAUDE.md).
  const ctx = await requirePermiso('registrar_asistencia');
  const { error } = await searchParams;

  // Un ensayo o una reunión de un equipo no se abren por aquí: son de la
  // agenda de su ministerio, con su lista y su guard. Con el id escrito a mano,
  // esta pantalla pintaba la congregación entera para meterla en esa lista.
  const reunion = await obtenerReunion(ctx, id);
  if (!reunion || reunion.ministerio) notFound();

  return (
    <>
      <CabeceraPanel
        titulo="Editar la reunión"
        volver={{ href: `/panel/reuniones/${id}`, texto: reunion.titulo }}
      />

      <Contenedor ancho="formulario">
        <FormularioReunion
          accion={editarReunion.bind(null, id)}
          reunion={reunion}
          error={error}
          hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
          cancelarHref={`/panel/reuniones/${id}`}
        />
      </Contenedor>
    </>
  );
}
