import type { Metadata } from 'next';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { puedeVerDatosSensibles } from '@/lib/auth/permisos';
import { listarMinisterios } from '@/lib/miembros/consultas';
import { crearMiembro } from '../actions';
import { FormularioMiembro } from '../_components/formulario';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';

export const metadata: Metadata = { title: 'Añadir a alguien' };

export default async function NuevoMiembroPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  // El guard va en la página además de en la acción. No es redundancia inútil:
  // aquí evita pintar un formulario que al enviarse rebotaría, y allí es lo que
  // de verdad impide escribir.
  const ctx = await requirePermiso('editar_miembros');
  const { error } = await searchParams;

  const ministerios = await listarMinisterios(ctx);

  return (
    <>
      <CabeceraPanel
        titulo="Añadir a alguien"
        volver={{ href: '/panel/miembros', texto: 'Miembros' }}
      />

      <Contenedor ancho="formulario">
        <FormularioMiembro
          accion={crearMiembro}
          ministerios={ministerios}
          puedeVerSensibles={puedeVerDatosSensibles(ctx)}
          error={error}
        />
      </Contenedor>
    </>
  );
}
