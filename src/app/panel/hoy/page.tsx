import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, Users } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import { resumenMiembros, listarMinisterios } from '@/lib/miembros/consultas';
import { Button } from '@/components/ui/button';
import { Aviso } from '@/components/aviso';

export const metadata: Metadata = { title: 'Inicio' };

/**
 * Pantalla de entrada del panel.
 *
 * De momento enseña las dos cifras que ya se pueden calcular de verdad. El
 * dashboard del diseño trae asistencia, donaciones y eventos, que son de la v2;
 * pintarlos ahora con datos inventados es la forma más rápida de que un pastor
 * deje de fiarse de todo lo demás.
 */
export default async function HoyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; bienvenida?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, bienvenida } = await searchParams;

  const [resumen, ministerios] = await Promise.all([
    resumenMiembros(ctx),
    listarMinisterios(ctx),
  ]);

  const puedeCrear = esPastor(ctx) || puede(ctx, 'editar_miembros');

  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          {ctx.iglesia.nombre}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {ctx.iglesia.ciudad ?? 'Panel de la iglesia'}
        </p>
      </header>

      <div className="flex w-full max-w-[1400px] flex-col gap-5 px-5 pb-12 pt-5 md:px-8">
        {error && <Aviso>{error}</Aviso>}

        {bienvenida && (
          <Aviso tipo="ok">
            Tu iglesia ya está creada. Tienes siete días de prueba, sin tarjeta.
          </Aviso>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tarjeta
            titulo="Personas en la iglesia"
            cifra={resumen.total}
            pie={
              resumen.nuevosDelMes > 0
                ? `${resumen.nuevosDelMes} este mes`
                : 'Sin altas este mes'
            }
          />
          <Tarjeta titulo="Ministerios activos" cifra={ministerios.length} />
        </div>

        {resumen.total === 0 && puedeCrear && (
          <section className="flex flex-col items-start gap-3.5 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Users className="size-5" strokeWidth={1.7} />
            </span>
            <div className="flex max-w-[520px] flex-col gap-1.5">
              <h2 className="t-subtitulo">Empieza por la congregación</h2>
              <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                Añade a las personas que ya vienen. No hace falta que tengas
                todos sus datos: con el nombre basta para empezar, y lo demás se
                completa con el tiempo.
              </p>
            </div>
            <Button render={<Link href="/panel/miembros/nuevo" />}>
              Añadir la primera persona
              <ArrowRight strokeWidth={1.9} />
            </Button>
          </section>
        )}
      </div>
    </>
  );
}

function Tarjeta({
  titulo,
  cifra,
  pie,
}: {
  titulo: string;
  cifra: number;
  pie?: string;
}) {
  return (
    <div className="flex flex-col gap-3.5 rounded-xl border border-border bg-surface p-5">
      <span className="t-micro">{titulo}</span>
      <span className="t-cifra">{cifra}</span>
      {pie && <span className="text-[13.5px] text-muted-foreground">{pie}</span>}
    </div>
  );
}
