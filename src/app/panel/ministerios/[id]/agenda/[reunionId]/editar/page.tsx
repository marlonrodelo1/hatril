import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import { obtenerReunion } from '@/lib/asistencia/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { FormularioReunion } from '../../../../../reuniones/_components/formulario';
import { editarReunionDeMinisterio } from '../../actions';

export const metadata: Metadata = { title: 'Editar de la agenda' };

export default async function EditarReunionMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, reunionId } = await params;
  // Las puertas de sus layouts aquí, y no solo allí: ver CLAUDE.md.
  const { ctx } = await requireModuloMinisterio(id, 'agenda');
  const { error } = await searchParams;

  const reunion = await obtenerReunion(ctx, reunionId);
  if (!reunion) notFound();
  // Igual que en el detalle: la guarda comprueba el ministerio de la URL, no
  // que la reunión sea suya.
  if (reunion.ministerio?.id !== id) notFound();

  const base = `/panel/ministerios/${id}/agenda`;

  return (
    <>
      <CabeceraPanel
        titulo="Editar"
        volver={{ href: `${base}/${reunionId}`, texto: reunion.titulo }}
      />

      <Contenedor ancho="formulario">
        <FormularioReunion
          accion={editarReunionDeMinisterio.bind(null, id, reunionId)}
          reunion={reunion}
          error={error}
          hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
          cancelarHref={`${base}/${reunionId}`}
          etiquetas={{
            titulo: 'Qué es',
            ejemploTitulo: 'Ensayo del jueves',
            ejemploLugar: 'La sala de música',
            // Las notas de un equipo las lee todo el equipo en su agenda, no
            // solo quien lo lleva: el campo lo dice, como el del turno.
            notas: 'Para el equipo',
            ejemploNotas: 'Traed los in-ear. Empezamos por el coro.',
            ayudaNotas: 'Lo ve todo el equipo. Instrucciones del ensayo, no cosas de las personas.',
          }}
        />
      </Contenedor>
    </>
  );
}
