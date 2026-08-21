import type { Metadata } from 'next';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { crearMinisterio } from '../actions';
import { FormularioMinisterio } from '../_components/formulario';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';

export const metadata: Metadata = { title: 'Crear ministerio' };

export default async function NuevoMinisterioPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requirePermiso('gestionar_ministerios');
  const { error } = await searchParams;

  return (
    <>
      <CabeceraPanel
        titulo="Crear un ministerio"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor ancho="formulario">
        <FormularioMinisterio accion={crearMinisterio} error={error} />
      </Contenedor>
    </>
  );
}
