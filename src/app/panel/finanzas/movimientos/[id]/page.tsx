import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

import { requireFinanzas } from '@/lib/auth/guard-panel';
import { movimiento, opciones } from '@/lib/finanzas/consultas';
import { arqueoDeUnIngreso } from '@/lib/finanzas/arqueos';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { formatearDinero } from '@/lib/format/dinero';
import { importeParaEditar } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
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
  // La guarda entera, también aquí: el layout no protege la página (CLAUDE.md).
  const ctx = await requireFinanzas();
  const { id } = await params;
  const { error } = await searchParams;

  // Un id que no es uuid llegaría a Postgres y el cast daría un 500.
  if (!z.string().uuid().safeParse(id).success) notFound();

  const m = await movimiento(ctx, id);
  // `notFound()` y no un mensaje: si la RLS no devuelve la fila es que no es de
  // esta iglesia, y contarlo confirmaría que ese id existe en alguna parte.
  if (!m) notFound();

  // Un ingreso que sale de un arqueo no se edita ni se borra (HT130): se
  // enseña tal cual, con quién lo contó y quién lo confirmó, y cómo se corrige.
  if (m.arqueoId) {
    const arqueo = await arqueoDeUnIngreso(ctx, m.arqueoId);
    const moneda = ctx.iglesia.moneda as Moneda;

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

          <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-1">
              <span className="t-micro">Entró</span>
              <span className="t-cifra tabular-nums">
                {formatearDinero(m.importe, moneda)}
              </span>
            </div>
            <p className="text-body first-letter:uppercase">
              {formatearFechaLarga(m.fecha)}
            </p>
            {arqueo && (
              <p className="text-pretty text-label text-muted-foreground">
                Sale del arqueo del culto: lo contó{' '}
                {arqueo.contadoPor ?? 'alguien que ya no está'} y lo confirmó{' '}
                {arqueo.confirmadoPor ?? 'alguien que ya no está'}.
              </p>
            )}
          </section>

          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-pretty text-label text-muted-foreground">
            Lo confirmado en un arqueo no se edita ni se borra: así lo que
            contaron dos personas no lo cambia una sola. Si hay un error, apunta
            un ajuste aparte en el libro, con su explicación en el concepto.
          </p>

          <Link
            href="/panel/finanzas/movimientos/nuevo"
            className={buttonVariants({ variant: 'outline' }) + ' w-fit'}
          >
            Apuntar un ajuste
          </Link>
        </Contenedor>
      </>
    );
  }

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
          <Button type="submit" variant="ghost" className="text-danger hover:bg-badge-danger-bg hover:text-danger">
            <Trash2 className="size-[16px]" strokeWidth={1.8} />
            Borrar este movimiento
          </Button>
        </form>
      </Contenedor>
    </>
  );
}
