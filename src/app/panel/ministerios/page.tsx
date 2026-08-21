import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronRight, HandHeart, Plus } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor, puede } from '@/lib/auth/permisos';
import {
  listarMinisteriosConEquipo,
  resumenMinisterios,
} from '@/lib/ministerios/consultas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { iniciales } from '@/lib/format/iniciales';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';

export const metadata: Metadata = { title: 'Ministerios' };

export default async function MinisteriosPage({
  searchParams,
}: {
  // Esta pantalla es el destino de rebote de `requireGestionMinisterio`: quien
  // entra a mano en el ministerio de otro acaba aquí. Sin leer el `?error=`
  // rebotaba en silencio, que se lee como que el enlace está roto.
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error } = await searchParams;

  const [ministerios, resumen] = await Promise.all([
    listarMinisteriosConEquipo(ctx),
    resumenMinisterios(ctx),
  ]);

  const puedeGestionar = esPastor(ctx) || puede(ctx, 'gestionar_ministerios');

  return (
    <>
      <CabeceraPanel
        titulo="Ministerios"
        subtitulo={
          resumen.equipos === 0
            ? 'Todavía no hay equipos'
            : `${resumen.equipos} ${resumen.equipos === 1 ? 'equipo' : 'equipos'} · ${resumen.personasSirviendo} ${resumen.personasSirviendo === 1 ? 'persona sirviendo' : 'personas sirviendo'}`
        }
      >
        {puedeGestionar && (
          <Button render={<Link href="/panel/ministerios/nuevo" />}>
            <Plus strokeWidth={1.9} />
            Crear ministerio
          </Button>
        )}
      </CabeceraPanel>

      <Contenedor>
        {error && <Aviso>{error}</Aviso>}

        {ministerios.length === 0 ? (
          <EstadoVacio puedeGestionar={puedeGestionar} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ministerios.map((m) => {
              const color = colorDeMinisterio(m.colorHex);

              return (
                <Link
                  key={m.id}
                  href={`/panel/ministerios/${m.id}`}
                  className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 text-foreground no-underline transition-colors hover:border-[#D5CCBE] hover:bg-[#FBF9F5] hover:no-underline"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="flex size-10 flex-none items-center justify-center rounded-[10px]"
                        style={{ background: color.suave }}
                      >
                        <span
                          className="size-3.5 rounded"
                          style={{ background: color.hex }}
                        />
                      </span>
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-[17px] font-bold tracking-[-0.018em]">
                          {m.nombre}
                        </span>
                        <span className="text-[13px] text-muted-foreground">
                          {m.voluntarios === 0
                            ? 'Sin nadie todavía'
                            : `${m.voluntarios} ${m.voluntarios === 1 ? 'voluntario' : 'voluntarios'}`}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="mt-2 size-4 flex-none text-[#A79E93]"
                      strokeWidth={1.9}
                    />
                  </div>

                  {/*
                   * El diseño remata la tarjeta con una barra de «han servido
                   * este mes». Eso sale de las asistencias, que son de la v2.
                   * Un porcentaje inventado aquí es peor que el hueco: en
                   * cuanto un pastor lo compare con lo que vio el domingo, deja
                   * de fiarse también de las cifras que sí son ciertas.
                   */}
                  {m.lider ? (
                    <div className="flex items-center gap-2.5 rounded-lg border border-border bg-surface-alt px-3 py-2.5">
                      <span className="flex size-7 flex-none items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground">
                        {iniciales(m.lider.nombre)}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-[13.5px] font-semibold">
                          {m.lider.nombre}
                        </span>
                        <span className="text-[12px] text-muted-foreground">
                          Responsable
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-[#D5CCBE] px-3 py-2.5 text-[13px] text-muted-foreground">
                      Sin responsable asignado
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </Contenedor>
    </>
  );
}

function EstadoVacio({ puedeGestionar }: { puedeGestionar: boolean }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-full bg-background text-muted-foreground">
        <HandHeart className="size-6" strokeWidth={1.5} />
      </span>

      <div className="flex max-w-[400px] flex-col gap-1.5">
        <span className="text-[18px] font-bold tracking-[-0.02em]">
          Organiza a quien sirve
        </span>
        <span className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          Alabanza, niños, intercesión, logística… Crea un equipo por cada área
          y ve de un vistazo quién está en cada una.
        </span>
      </div>

      {/* En `outline` porque cuando esto se ve, arriba se está viendo también
          «Crear ministerio», que lleva al mismo sitio. Dos botones naranjas
          idénticos en la misma pantalla es justo lo que el sistema de diseño
          prohíbe: el naranja se queda en la cabecera, que está siempre. */}
      {puedeGestionar && (
        <Button variant="outline" render={<Link href="/panel/ministerios/nuevo" />}>
          <Plus strokeWidth={1.9} />
          Crear el primer ministerio
        </Button>
      )}
    </div>
  );
}
