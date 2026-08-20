import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { movimiento, opciones } from '@/lib/finanzas/consultas';
import { importeParaEditar } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
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
      <header className="flex flex-col gap-1 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/finanzas/movimientos"
          className="flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-[15px]" strokeWidth={1.8} />
          Libro de movimientos
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          {m.concepto}
        </h1>
      </header>

      <div className="flex w-full max-w-[560px] flex-1 flex-col gap-5 px-5 pb-10 pt-6 md:px-8">
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
      </div>
    </>
  );
}
