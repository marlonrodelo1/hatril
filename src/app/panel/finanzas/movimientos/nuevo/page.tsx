import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { opciones } from '@/lib/finanzas/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { crearMovimiento } from '../../actions';
import { FormularioMovimiento } from '../_components/formulario';

export const metadata: Metadata = { title: 'Apuntar movimiento' };

export default async function NuevoMovimientoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const { fondos, cajas } = await opciones(ctx);
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <>
      <CabeceraPanel
        titulo="Apuntar movimiento"
        volver={{
          href: '/panel/finanzas/movimientos',
          texto: 'Libro de movimientos',
        }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <FormularioMovimiento
          accion={crearMovimiento}
          fondos={fondos}
          cajas={cajas}
          valores={{ fecha: hoy }}
          textoEnviar="Apuntar"
        />
      </Contenedor>
    </>
  );
}
