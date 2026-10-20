import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, ChevronRight, CircleX } from 'lucide-react';

import { requireModuloMinisterio } from '@/lib/auth/guard-panel';
import { listarTurnos, type TurnoResumen } from '@/lib/turnos/consultas';
import { puestosDelMinisterio } from '@/lib/turnos/puestos';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { sumarDias } from '@/lib/agenda/horarios';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { guardarPuestos } from './actions';
import { CONFIRMACIONES } from './constantes';

export const metadata: Metadata = { title: 'Turnos del ministerio' };

/**
 * El cuadrante de un equipo: los próximos cultos y quién va a cada puesto.
 *
 * LO QUE SE CUENTA ES EL HUECO, NO LA GENTE
 * -----------------------------------------
 * La pregunta con la que alguien abre esta pantalla es «¿qué me falta por
 * cubrir?», no «¿cuánta gente hay?». Por eso cada turno dice qué puestos siguen
 * vacíos, y un «no puede» cuenta como vacío: el puesto tiene un nombre al lado y
 * aun así nadie va a ir.
 *
 * Un «sin contestar», en cambio, cuenta como cubierto. Mucha gente del equipo no
 * usa la aplicación, y si su silencio contara como hueco el cuadrante saldría
 * medio vacío todas las semanas con el equipo completo — ver
 * `respuestaTurnoEnum`.
 */
export default async function TurnosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  // Las puertas de sus layouts aquí, y no solo allí: ver CLAUDE.md.
  const { ctx, ministerio } = await requireModuloMinisterio(id, 'turnos');
  const { error, guardado } = await searchParams;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const puestos = puestosDelMinisterio(ministerio);

  const [proximos, anteriores] = await Promise.all([
    listarTurnos(ctx, id, { desde: hoy, orden: 'asc', limite: 30 }),
    listarTurnos(ctx, id, { hasta: sumarDias(hoy, -1), orden: 'desc', limite: 5 }),
  ]);

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Quién sirve en cada culto y en qué puesto"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        <Button render={<Link href={`/panel/ministerios/${id}/turnos/planificar`} />}>
          <CalendarPlus strokeWidth={1.8} />
          Planificar
        </Button>
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="turnos" />

        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {proximos.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">No hay turnos por delante</h2>
            <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Elige en qué cultos de las próximas semanas sirve el equipo y
              después pon a cada persona en su puesto. A quien tenga la
              aplicación le llega un aviso y puede confirmar desde su agenda.
            </p>
            <Button
              variant="outline"
              render={<Link href={`/panel/ministerios/${id}/turnos/planificar`} />}
            >
              <CalendarPlus strokeWidth={1.8} />
              Planificar las próximas semanas
            </Button>
          </div>
        ) : (
          <section className="flex flex-col gap-2.5">
            <h2 className="t-micro px-1">Próximos</h2>
            <ul className="flex flex-col gap-2.5">
              {proximos.map((t) => (
                <li key={t.id}>
                  <TarjetaTurno
                    turno={t}
                    puestos={puestos}
                    href={`/panel/ministerios/${id}/turnos/${t.id}`}
                    hoy={hoy}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}

        {anteriores.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="t-micro px-1">Anteriores</h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {anteriores.map((t) => (
                <li key={t.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={`/panel/ministerios/${id}/turnos/${t.id}`}
                    className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[14.5px] first-letter:uppercase">
                      {formatearFechaLarga(t.fecha)}
                      {t.hora && ` · ${t.hora}`}
                      <span className="text-muted-foreground"> · {t.titulo}</span>
                    </span>
                    <span className="flex-none text-[13px] text-muted-foreground">
                      {personasDistintas(t)}{' '}
                      {personasDistintas(t) === 1 ? 'persona' : 'personas'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section
          id="puestos"
          className="flex scroll-mt-24 flex-col gap-3.5 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Los puestos del equipo</h2>
            <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
              Uno por línea, en el orden en que quieres verlos en cada turno.
              Cambiarlos no toca los turnos pasados: quien estuvo en «Voces»
              sigue apareciendo así aunque ahora se llame «Coros».
            </p>
          </div>

          <form action={guardarPuestos.bind(null, id)} className="flex flex-col gap-3">
            <textarea
              name="puestos"
              aria-label="Puestos del equipo, uno por línea"
              rows={Math.min(Math.max(puestos.length + 1, 4), 12)}
              defaultValue={puestos.join('\n')}
              className="max-w-[420px] rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
            <div>
              <Button type="submit" variant="outline">
                Guardar los puestos
              </Button>
            </div>
          </form>
        </section>
      </Contenedor>
    </>
  );
}

/**
 * Una tarjeta de turno: cuándo, qué falta por cubrir y quién ha dicho que no.
 */
function TarjetaTurno({
  turno: t,
  puestos,
  href,
  hoy,
}: {
  turno: TurnoResumen;
  puestos: string[];
  href: string;
  hoy: string;
}) {
  const { faltan, noPueden, sinContestar } = estadoDelTurno(t, puestos);
  const completo = faltan.length === 0;

  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline transition-colors hover:border-support-hover hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-[16px] font-bold tracking-[-0.015em] first-letter:uppercase">
            {t.fecha === hoy ? 'Hoy' : formatearFechaLarga(t.fecha)}
          </span>
          <span className="text-[13.5px] text-muted-foreground">
            {t.hora && `${t.hora} · `}
            {t.titulo}
          </span>
        </span>

        <span className="flex flex-wrap items-center gap-1.5 text-[12.5px] font-semibold">
          <span
            className={
              'rounded-md px-2 py-0.5 ' +
              (completo
                ? 'bg-badge-success-bg text-badge-success-fg'
                : 'bg-badge-warning-bg text-badge-warning-fg')
            }
          >
            {completo
              ? 'Todos los puestos cubiertos'
              : `${puestos.length - faltan.length} de ${puestos.length} puestos`}
          </span>

          {noPueden > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-badge-danger-bg px-2 py-0.5 text-badge-danger-fg">
              <CircleX className="size-3.5" strokeWidth={2} aria-hidden />
              {noPueden} no {noPueden === 1 ? 'puede' : 'pueden'}
            </span>
          )}

          {sinContestar > 0 && (
            <span className="rounded-md bg-badge-neutral-bg px-2 py-0.5 text-badge-neutral-fg">
              {sinContestar} sin contestar
            </span>
          )}
        </span>

        {!completo && (
          <span className="truncate text-[13px] text-muted-foreground">
            Falta: {faltan.join(', ')}
          </span>
        )}
      </div>

      <ChevronRight
        className="size-4 flex-none text-disabled-text"
        strokeWidth={1.9}
        aria-hidden
      />
    </Link>
  );
}

/**
 * Qué puestos siguen vacíos y cuánta gente no ha contestado o no puede.
 *
 * Los puestos se comparan sin mayúsculas, como el índice único de la base: el
 * responsable pudo escribir «guitarra» en un turno y «Guitarra» en la lista.
 */
function estadoDelTurno(t: TurnoResumen, puestos: string[]) {
  const ocupados = new Set(
    t.personas
      .filter((p) => p.respuesta !== 'no_puede')
      .map((p) => p.puesto.toLocaleLowerCase('es')),
  );

  // Por persona y no por fila: quien tiene dos puestos y no ha contestado es
  // UNA persona a la que llamar.
  const porPersona = new Map<string, Set<string>>();
  for (const p of t.personas) {
    porPersona.set(p.miembroId, (porPersona.get(p.miembroId) ?? new Set()).add(p.respuesta));
  }
  const respuestas = [...porPersona.values()];

  return {
    faltan: puestos.filter((p) => !ocupados.has(p.toLocaleLowerCase('es'))),
    noPueden: respuestas.filter((r) => r.has('no_puede')).length,
    sinContestar: respuestas.filter((r) => !r.has('no_puede') && r.has('pendiente')).length,
  };
}

function personasDistintas(t: TurnoResumen): number {
  return new Set(t.personas.map((p) => p.miembroId)).size;
}
