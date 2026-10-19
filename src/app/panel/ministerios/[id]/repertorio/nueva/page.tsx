import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { FormularioCancion } from '../_components/formulario-cancion';
import { crearCancion } from '../actions';

export const metadata: Metadata = { title: 'Añadir canción' };

export default async function NuevaCancionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const base = `/panel/ministerios/${id}/repertorio`;

  return (
    <>
      <CabeceraPanel
        titulo="Añadir canción"
        volver={{ href: base, texto: `Repertorio de ${ministerio.nombre}` }}
      />

      <Contenedor ancho="formulario">
        <FormularioCancion
          accion={crearCancion.bind(null, id)}
          error={error}
          cancelarHref={base}
        />
      </Contenedor>
    </>
  );
}
