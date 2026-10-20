import type { Metadata } from 'next';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { FormularioReunion } from '../../../../reuniones/_components/formulario';
import { crearReunionDeMinisterio } from '../actions';
import { SEMANAS_MAXIMAS } from '../constantes';

export const metadata: Metadata = { title: 'Apuntar en la agenda' };

export default async function NuevaReunionMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  // Las puertas de sus layouts aquí, y no solo allí: ver CLAUDE.md.
  const { ctx, ministerio } = await requireModuloMinisterio(id, 'agenda');
  const { error } = await searchParams;

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
            // Las notas de un equipo las lee todo el equipo en su agenda, no
            // solo quien lo lleva: el campo lo dice, como el del turno.
            notas: 'Para el equipo',
            ejemploNotas: 'Traed los in-ear. Empezamos por el coro.',
            ayudaNotas: 'Lo ve todo el equipo. Instrucciones del ensayo, no cosas de las personas.',
          }}
          repetirHasta={SEMANAS_MAXIMAS}
        />
      </Contenedor>
    </>
  );
}
