import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MapPin } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { reunionParaMiembro } from '@/lib/agenda/ensayos';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../../../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Agenda del equipo' };

/**
 * Un ensayo, o cualquier reunión de un equipo, visto desde dentro del equipo.
 *
 * Antes la fila del calendario llevaba a la propia agenda, y el músico no tenía
 * forma de leer el lugar entero ni las notas («traed los in-ear», «empezamos
 * por el coro»): las escribía el responsable y no le llegaban a nadie.
 *
 * Solo lectura. Lo que se hace con un ensayo —cambiarlo, pasar lista— lo hace
 * el responsable desde el panel. Fuera del equipo es un 404: lo decide
 * `reunionParaMiembro()`, que mira la pertenencia real.
 */
export default async function ReunionMiembroPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { id } = await params;

  const reunion = await reunionParaMiembro(ctx, id);
  if (!reunion) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const color = colorDeMinisterio(reunion.ministerio.colorHex);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Agenda del equipo"
        subtitulo={reunion.ministerio.nombre}
        volver="/mi/agenda"
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              {reunion.ministerio.nombre}
            </span>
            <h1 className="text-[22px] font-bold leading-tight tracking-[-0.022em] first-letter:uppercase">
              {formatearFechaLarga(reunion.fecha)}
            </h1>
            <span className="text-[15px] text-muted-foreground">
              {reunion.hora && `${reunion.hora} · `}
              {reunion.titulo}
            </span>
          </div>

          {reunion.lugar && (
            <span className="inline-flex items-start gap-2 border-t border-border pt-4 text-[15px]">
              <MapPin
                className="mt-0.5 size-[18px] flex-none text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              {reunion.lugar}
            </span>
          )}

          {reunion.notas && (
            // `whitespace-pre-line`: el responsable las escribe en líneas
            // —«1. Coro / 2. Puente»— y en un solo párrafo dejan de leerse.
            <p className="whitespace-pre-line rounded-lg border border-border bg-surface-alt px-4 py-3 text-pretty text-[14.5px] leading-relaxed">
              {reunion.notas}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
