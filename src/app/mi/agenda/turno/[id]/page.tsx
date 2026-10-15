import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { turnoParaMiembro } from '@/lib/turnos/consultas';
import { ETIQUETA_RESPUESTA } from '@/lib/turnos/respuestas';
import { colorDeMinisterio } from '@/lib/ministerios/colores';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { createClient } from '@/lib/supabase/server';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from '../../../_components/cabecera-miembro';
import { responderTurno } from '../../actions';
import { CONFIRMACIONES_TURNO as CONFIRMACIONES } from '../../constantes';

export const metadata: Metadata = { title: 'Turno' };

/**
 * Un turno, visto desde dentro del equipo.
 *
 * Lo abre quien sirve en ese culto, desde su aviso o desde la agenda, y también
 * cualquiera del mismo equipo que quiera ver con quién le toca. Fuera del equipo
 * es un 404: lo decide `turnoParaMiembro()`, que mira la pertenencia real.
 *
 * El único botón naranja es el de confirmar, y solo cuando falta: con el turno
 * ya confirmado, lo que queda es la salida discreta de «al final no puedo».
 */
export default async function TurnoMiembroPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { id } = await params;
  const { error, guardado } = await searchParams;

  const turno = await turnoParaMiembro(ctx, id);
  if (!turno) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const color = colorDeMinisterio(turno.ministerio.colorHex);
  const responder = responderTurno.bind(null, turno.id);
  const estado = turno.mio ? ETIQUETA_RESPUESTA[turno.mio.respuesta] : null;

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Turno"
        subtitulo={turno.ministerio.nombre}
        volver="/mi/agenda"
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: color.hex }}
                aria-hidden
              />
              {turno.ministerio.nombre}
            </span>
            <h1 className="text-[22px] font-bold leading-tight tracking-[-0.022em] first-letter:uppercase">
              {formatearFechaLarga(turno.fecha)}
            </h1>
            <span className="text-[15px] text-muted-foreground">
              {turno.hora && `${turno.hora} · `}
              {turno.titulo}
            </span>
          </div>

          {turno.mio && estado && (
            <div className="flex flex-col gap-3 border-t border-border pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px]">
                  Te toca:{' '}
                  <span className="font-bold">{turno.mio.puestos.join(', ')}</span>
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12.5px] font-semibold ${estado.clase}`}
                >
                  <estado.Icono className="size-3.5" strokeWidth={2.2} aria-hidden />
                  {estado.miembro}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {turno.mio.respuesta !== 'confirmado' && (
                  <form action={responder}>
                    <input type="hidden" name="respuesta" value="confirmado" />
                    <input type="hidden" name="desde" value="turno" />
                    <Button type="submit">
                      {turno.mio.respuesta === 'no_puede' ? 'Al final sí puedo' : 'Ahí estaré'}
                    </Button>
                  </form>
                )}
                {turno.mio.respuesta !== 'no_puede' && (
                  <form action={responder}>
                    <input type="hidden" name="respuesta" value="no_puede" />
                    <input type="hidden" name="desde" value="turno" />
                    <Button type="submit" variant="outline">
                      {turno.mio.respuesta === 'confirmado' ? 'Al final no puedo' : 'No puedo'}
                    </Button>
                  </form>
                )}
              </div>
            </div>
          )}

          {turno.notas && (
            <p className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-pretty text-[14.5px] leading-relaxed">
              {turno.notas}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Quién sirve
          </h2>

          {turno.equipo.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-[14.5px] text-muted-foreground">
              Todavía no hay nadie puesto en este turno.
            </p>
          ) : (
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {turno.equipo.map((p) => (
                <li
                  key={p.puesto}
                  className="flex items-baseline gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span className="w-[38%] flex-none text-[13.5px] font-semibold text-muted-foreground">
                    {p.puesto}
                  </span>
                  <span className="min-w-0 flex-1 text-[14.5px]">
                    {p.nombres.join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
