import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Archive, ChevronLeft } from 'lucide-react';

import { requirePermiso } from '@/lib/auth/guard-panel';
import {
  obtenerMinisterio,
  integrantesParaLider,
} from '@/lib/ministerios/consultas';
import { archivarMinisterio, editarMinisterio } from '../../actions';
import { FormularioMinisterio } from '../../_components/formulario';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Editar ministerio' };

export default async function EditarMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requirePermiso('gestionar_ministerios');
  const { id } = await params;
  const { error } = await searchParams;

  const [ministerio, integrantes] = await Promise.all([
    obtenerMinisterio(ctx, id),
    integrantesParaLider(ctx, id),
  ]);

  if (!ministerio) notFound();

  const guardar = editarMinisterio.bind(null, ministerio.id);
  const archivar = archivarMinisterio.bind(null, ministerio.id);

  return (
    <>
      <header className="flex flex-col gap-2 border-b border-border bg-surface px-5 py-4 md:px-8">
        <Link
          href={`/panel/ministerios/${ministerio.id}`}
          className="inline-flex w-fit items-center gap-1 text-[13px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
        >
          <ChevronLeft className="size-4" strokeWidth={1.8} />
          {ministerio.nombre}
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Editar el ministerio
        </h1>
      </header>

      <div className="flex w-full max-w-[680px] flex-col gap-8 px-5 pb-16 pt-6 md:px-8">
        <FormularioMinisterio
          accion={guardar}
          ministerio={ministerio}
          integrantes={integrantes}
          error={error}
        />

        <section className="flex flex-col gap-3 rounded-xl border border-[#E0C4C2] bg-surface p-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="t-subtitulo">Cerrar el ministerio</h2>
            <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Deja de aparecer en el panel y las{' '}
              {ministerio.voluntarios === 1
                ? 'persona que lo forma sale'
                : `${ministerio.voluntarios} personas que lo forman salen`}{' '}
              del equipo. No se borra nada: en la ficha de cada una seguirá
              constando que sirvió aquí.
            </p>
          </div>

          {/* Formulario propio, separado del de arriba. Con los dos botones en
              el mismo formulario, pulsar Enter mientras se corrige el nombre
              cerraría el ministerio entero. */}
          <form action={archivar} className="w-fit">
            <Button type="submit" variant="destructive">
              <Archive strokeWidth={1.7} />
              Cerrar {ministerio.nombre}
            </Button>
          </form>
        </section>
      </div>
    </>
  );
}
