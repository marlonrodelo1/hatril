import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarClock, MapPin, Ticket } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misMinisterios } from '@/lib/ministerios/consultas';
import { proximasDeMisMinisterios } from '@/lib/asistencia/consultas';
import { eventosPublicos } from '@/lib/eventos/publica';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { hoyEnLaIglesia, formatearFechaLarga } from '@/lib/fecha/hoy';
import { formatearInstante } from '@/lib/fecha/zona';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';

export const metadata: Metadata = { title: 'Agenda' };

/**
 * Qué tengo yo esta semana.
 *
 * JUNTA DOS COSAS QUE EL PANEL TIENE SEPARADAS
 * ---------------------------------------------
 * Los eventos son de la iglesia y las reuniones son de cada equipo, y en el
 * panel viven en secciones distintas porque quien los gestiona es distinto. Para
 * un miembro es la misma pregunta, y separarlas le obliga a mirar en dos sitios
 * para contestarla.
 */
export default async function AgendaPage() {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const ministerios = await misMinisterios(ctx);

  const [ensayos, eventos] = await Promise.all([
    proximasDeMisMinisterios(
      ctx,
      ministerios.map((m) => m.id),
      hoy,
    ),
    // Los mismos que salen en la web de la iglesia: publicados y por venir. Un
    // miembro no tiene por qué ver los borradores que el equipo está preparando.
    eventosPublicos(ctx.iglesia.id),
  ]);

  const vacio = ensayos.length === 0 && eventos.length === 0;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Agenda"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-6 px-4 py-6 sm:px-5">
        {vacio && (
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <h1 className="t-subtitulo">No tienes nada apuntado</h1>
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              Aquí aparecerán los eventos de {ctx.iglesia.nombre} y los ensayos y
              actividades de los equipos en los que sirvas.
            </p>
          </div>
        )}

        {eventos.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="t-subtitulo">Eventos de la iglesia</h2>
            <ul className="flex flex-col gap-2.5">
              {eventos.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/i/${ctx.iglesia.slug}/eventos/${e.id}`}
                    className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-[#D5CCBE] hover:bg-[#FBF9F5] hover:no-underline"
                  >
                    <span className="flex size-10 flex-none items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
                      <Ticket className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15.5px] font-bold tracking-[-0.015em]">
                        {e.titulo}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2.5 text-[13px] text-muted-foreground">
                        <span className="first-letter:uppercase">
                          {formatearInstante(e.inicioEn, ctx.iglesia.timezone)}
                        </span>
                        {e.lugar && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" strokeWidth={1.8} />
                            {e.lugar}
                          </span>
                        )}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {ensayos.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="t-subtitulo">De tus equipos</h2>
            <ul className="flex flex-col gap-2.5">
              {ensayos.map((r) => {
                const color = colorDeMinisterio(r.ministerio.colorHex);
                return (
                  <li
                    key={r.id}
                    className="flex items-center gap-3.5 rounded-xl border border-border bg-surface p-4"
                  >
                    <span
                      className="flex size-10 flex-none items-center justify-center rounded-[10px]"
                      style={{ background: color.suave }}
                    >
                      <CalendarClock
                        className="size-[18px]"
                        style={{ color: color.hex }}
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-[15.5px] font-bold tracking-[-0.015em]">
                        {r.titulo}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-2.5 text-[13px] text-muted-foreground">
                        <span className="first-letter:uppercase">
                          {formatearFechaLarga(r.fecha)}
                        </span>
                        {r.hora && <span>· {r.hora.slice(0, 5)}</span>}
                        {r.lugar && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3.5" strokeWidth={1.8} />
                            {r.lugar}
                          </span>
                        )}
                        <span>· {r.ministerio.nombre}</span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}
