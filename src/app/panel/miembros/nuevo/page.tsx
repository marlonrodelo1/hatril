import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import { puedeVerDatosSensibles } from '@/lib/auth/permisos';
import { listarMinisterios } from '@/lib/miembros/consultas';
import { crearMiembro } from '../actions';
import { FormularioMiembro } from '../_components/formulario';

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
      <header className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href="/panel/miembros"
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          Miembros
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Añadir a alguien
        </h1>
      </header>

      <div className="w-full max-w-[760px] px-5 pb-16 pt-6 md:px-8">
        <FormularioMiembro
          accion={crearMiembro}
          ministerios={ministerios}
          puedeVerSensibles={puedeVerDatosSensibles(ctx)}
          error={error}
        />
      </div>
    </>
  );
}
