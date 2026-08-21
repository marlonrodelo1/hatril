import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { movimiento, opciones } from '@/lib/finanzas/consultas';
import { importeParaEditar } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { borrarMovimiento, editarMovimiento } from '../../actions';
import { FormularioMovimiento } from '../_components/formulario';

export const metadata: Metadata = { title: 'Movimiento' };

export default async function MovimientoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { id } = await params;
  const { error } = await searchParams;

  const m = await movimiento(ctx, id);
  // `notFound()` y no un mensaje: si la RLS no devuelve la fila es que no es de
  // esta iglesia, y contarlo confirmaría que ese id existe en alguna parte.
  if (!m) notFound();

  const { fondos, cajas } = await opciones(ctx);

  return (
    <>
      <CabeceraPanel
        titulo={m.concepto}
        volver={{
          href: '/panel/finanzas/movimientos',
          texto: 'Libro de movimientos',
        }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}

        <FormularioMovimiento
          accion={editarMovimiento}
          idMovimiento={m.id}
          fondos={fondos}
          cajas={cajas}
          valores={{
            tipo: m.tipo,
            fecha: m.fecha,
            importe: importeParaEditar(m.importe, ctx.iglesia.moneda as Moneda),
            concepto: m.concepto,
            fondoId: m.fondoId,
            cajaId: m.cajaId,
            metodoPago: m.metodoPago,
            tipoIngreso: m.tipoIngreso ?? undefined,
            referencia: m.referencia ?? undefined,
          }}
          textoEnviar="Guardar cambios"
        />

        {/* Borrar de verdad. En la v1 no hay cierre de periodo que proteger, así
            que un apunte equivocado se quita y ya está. Cuando exista el cierre,
            esto tendrá que pasar a ser un asiento de corrección. */}
        <form action={borrarMovimiento} className="border-t border-border pt-5">
          <input type="hidden" name="id" value={m.id} />
          <Button type="submit" variant="ghost" className="text-danger">
            <Trash2 className="size-[16px]" strokeWidth={1.8} />
            Borrar este movimiento
          </Button>
        </form>
      </Contenedor>
    </>
  );
}
