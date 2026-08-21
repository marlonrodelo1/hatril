import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';
import { FormularioReunion } from '../_components/formulario';
import { crearReunion } from '../actions';

export const metadata: Metadata = { title: 'Apuntar reunión' };

export default async function NuevaReunionPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  return (
    <>
      <CabeceraPanel
        titulo="Apuntar una reunión"
        volver={{ href: '/panel/reuniones', texto: 'Reuniones' }}
      />

      <Contenedor ancho="formulario">
        <FormularioReunion
          accion={crearReunion}
          error={error}
          // La fecha por defecto se calcula EN LA IGLESIA y no en el servidor:
          // con la base en Irlanda y la congregación en Bogotá, un domingo por
          // la tarde el contenedor ya está en lunes y el culto se apuntaría con
          // la fecha del día siguiente.
          hoy={hoyEnLaIglesia(ctx.iglesia.timezone)}
          cancelarHref="/panel/reuniones"
        />
      </Contenedor>
    </>
  );
}
