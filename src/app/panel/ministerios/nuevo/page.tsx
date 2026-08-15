import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { crearMinisterio } from '../actions';
import { FormularioMinisterio } from '../_components/formulario';

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
      <header className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/ministerios"
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          Ministerios
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Crear un ministerio
        </h1>
      </header>

      <div className="w-full max-w-[680px] px-5 pb-16 pt-6 md:px-8">
        <FormularioMinisterio accion={crearMinisterio} error={error} />
      </div>
    </>
  );
}
