import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { FormularioReunion } from '../../../../reuniones/_components/formulario';
import { crearReunionDeMinisterio } from '../actions';

export const metadata: Metadata = { title: 'Apuntar en la agenda' };

export default async function NuevaReunionMinisterioPage({
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

  const base = `/panel/ministerios/${id}/agenda`;

  return (
    <>
      <CabeceraPanel
        titulo="Apuntar en la agenda"
        volver={{ href: base, texto: ministerio.nombre }}
      />

      <Contenedor ancho="formulario">
        {/* El mismo formulario que los cultos: una reunión es una reunión, y
            mantener dos habría dejado el arreglo de los segundos en `hora` en
            uno solo. Solo cambian los textos que harían dudar de si se está en
            la pantalla correcta. */}
        <FormularioReunion
          accion={crearReunionDeMinisterio.bind(null, id)}
          error={error}
          hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
          cancelarHref={base}
          etiquetas={{
            titulo: 'Qué es',
            ejemploTitulo: 'Ensayo del jueves',
            ejemploLugar: 'La sala de música',
          }}
        />
      </Contenedor>
    </>
  );
}
