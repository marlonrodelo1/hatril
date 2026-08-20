import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { opciones } from '@/lib/finanzas/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
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
      <header className="flex flex-col gap-1 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/finanzas/movimientos"
          className="flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-[15px]" strokeWidth={1.8} />
          Libro de movimientos
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Apuntar movimiento
        </h1>
      </header>

      <div className="flex w-full max-w-[560px] flex-1 flex-col gap-5 px-5 pb-10 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}

        <FormularioMovimiento
          accion={crearMovimiento}
          fondos={fondos}
          cajas={cajas}
          valores={{ fecha: hoy }}
          textoEnviar="Apuntar"
        />
      </div>
    </>
  );
}
