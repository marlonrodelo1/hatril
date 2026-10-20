import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClock, ChevronRight, ExternalLink } from 'lucide-react';
import { notFound } from 'next/navigation';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { turnoParaMiembro } from '@/lib/turnos/consultas';
import { cancionesDelTurno } from '@/lib/repertorio/consultas';
import { diaYHora, ensayoAntesDelTurno } from '@/lib/agenda/ensayos';
import { sitioDe } from '@/lib/repertorio/enlaces';
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

  // Después de comprobar que el turno es de su equipo, y no en paralelo: la
  // lista solo se pide para quien ya ha pasado esa puerta.
  //
  // Sin mirar si el repertorio está encendido. Si el equipo lo apagó, la lista
  // de un domingo que ya se preparó sigue siendo lo que se va a tocar.
  //
  // El ensayo, igual: la reunión del mismo equipo en la semana de antes, que es
  // de su equipo por la misma puerta.
  const [canciones, ensayo] = await Promise.all([
    cancionesDelTurno(ctx, turno.id),
    ensayoAntesDelTurno(ctx, {
      ministerioId: turno.ministerio.id,
      fecha: turno.fecha,
      hora: turno.hora,
    }),
  ]);

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
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
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

          {ensayo && (
            // Las notas del ensayo van aquí mismo, recortadas: «traed los
            // in-ear» es lo que hay que leer antes de salir de casa, y abrir
            // otra pantalla para verlo es lo que hacía que no llegara.
            <Link
              href={`/mi/agenda/reunion/${ensayo.id}`}
              className="group flex items-start gap-3 border-t border-border pt-4 text-foreground no-underline hover:no-underline"
            >
              <CalendarClock
                className="mt-0.5 size-[18px] flex-none text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-pretty text-[14.5px] leading-snug">
                  <span className="font-semibold underline-offset-4 group-hover:underline">
                    {ensayo.titulo}:
                  </span>{' '}
                  {diaYHora(ensayo.fecha, ensayo.hora)}
                  {ensayo.lugar && (
                    <span className="text-muted-foreground"> · {ensayo.lugar}</span>
                  )}
                </span>
                {ensayo.notas && (
                  <span className="line-clamp-3 whitespace-pre-line text-pretty text-[13.5px] leading-snug text-muted-foreground">
                    {ensayo.notas}
                  </span>
                )}
              </span>
              <ChevronRight
                className="mt-0.5 size-4 flex-none text-disabled-text"
                strokeWidth={1.9}
                aria-hidden
              />
            </Link>
          )}
        </section>

        {canciones.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Qué se toca
            </h2>
            <ol className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {canciones.map((c, i) => {
                const tono = c.tonoDelDia ?? c.tono;
                return (
                  <li
                    key={c.filaId}
                    className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0"
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="w-4 flex-none text-right text-[13px] font-bold tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="text-[15px] font-semibold leading-snug">
                          {c.titulo}
                        </span>
                        {c.autor && (
                          <span className="text-[13px] text-muted-foreground">
                            {c.autor}
                          </span>
                        )}
                      </span>
                      {tono && (
                        // El tono es lo que el músico viene a mirar: en grande
                        // y a la derecha, donde el ojo lo encuentra sin leer.
                        <span className="flex-none rounded-md bg-badge-neutral-bg px-2 py-0.5 text-[14px] font-bold text-foreground">
                          {tono}
                        </span>
                      )}
                    </div>

                    {(c.enlaceAudio || c.enlacePartitura || c.notas) && (
                      <div className="flex flex-col gap-1.5 pl-7">
                        {c.notas && (
                          <p className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
                            {c.notas}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {c.enlaceAudio && (
                            <EnlaceFuera href={c.enlaceAudio} texto="Escuchar" />
                          )}
                          {c.enlacePartitura && (
                            <EnlaceFuera href={c.enlacePartitura} texto="Acordes" />
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

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

/**
 * Un enlace que sale de Hatril, con el sitio escrito al lado.
 *
 * Quien pulsa «Escuchar» tiene que ver antes de pulsar a dónde va: es la
 * diferencia entre el YouTube de siempre y una web que alguien pegó en el
 * repertorio. Y en otra pestaña, para no perder el turno al volver.
 */
function EnlaceFuera({ href, texto }: { href: string; texto: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground underline-offset-4 hover:underline"
    >
      <ExternalLink className="size-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
      {texto}
      <span className="font-normal text-muted-foreground">{sitioDe(href)}</span>
    </a>
  );
}
