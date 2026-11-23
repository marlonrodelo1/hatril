'use client';

import { useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { MapPin } from 'lucide-react';

import type { HorarioSemanal } from '@/lib/db/schema';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Insignia } from '@/components/ui/insignia';
import { useMinuto } from './horarios-reloj';
import {
  COLUMNAS,
  hoyEnLaIglesia,
  proximaEnLaSemana,
  repartirPorDias,
  siguienteTras,
  textoCuentaAtras,
} from './horarios-semana';

/**
 * Los horarios en una semana: «Lo próximo» con su cuenta atrás y, debajo, la
 * tira de lunes a domingo (zona 3 del rediseño, aprobada el 17-nov).
 *
 * Antes era una tarjeta grande por reunión, una debajo de otra: con cuatro
 * reuniones ya pasaba de un pantallazo y medio en el móvil, y «Lo próximo»
 * repetía la primera tarjeta de debajo. Ahora en el móvil se toca un día y
 * salen sus reuniones; en escritorio, que hay sitio, los siete días van en
 * columnas y no hay que tocar nada.
 *
 * LA HORA ES LA DE LA IGLESIA
 * ---------------------------
 * «Hoy», las fechas de la tira y la cuenta atrás salen de la zona de la
 * iglesia, no de la de quien mira: alguien en Madrid que abre la web de una
 * iglesia de Bogotá ve los horarios de Bogotá. Y se recalculan en el navegador
 * cada minuto (`useMinuto`), porque la página va con ISR y la copia que llega
 * puede ser de hace horas.
 */
export function VistaHorarios({
  horarios,
  timezone,
  generadoEn,
  tieneContacto,
}: {
  horarios: HorarioSemanal[];
  timezone: string;
  /** El minuto en que se generó la página: lo que se pinta hasta hidratar. */
  generadoEn: number;
  tieneContacto: boolean;
}) {
  const instante = useMinuto(generadoEn);
  const hoy = useMemo(() => hoyEnLaIglesia(timezone, instante), [timezone, instante]);
  const { dias, sinDia } = useMemo(() => repartirPorDias(horarios), [horarios]);
  const proxima = proximaEnLaSemana(dias, hoy);
  const hayDias = dias.some((d) => d.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {proxima && (
        <div className="flex flex-col gap-4 rounded-xl bg-support p-5 text-secondary-foreground md:flex-row md:items-end md:justify-between md:gap-8 md:p-7">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="t-micro text-support-muted-foreground">
              Lo próximo · {proxima.cuando}
            </span>
            <span className="text-pretty text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
              {proxima.horario.nombre}
            </span>
            <span className="max-w-[560px] text-pretty text-body leading-relaxed text-support-muted-foreground">
              A las {proxima.horario.hora}
              {proxima.horario.detalle ? ` · ${proxima.horario.detalle}` : ''}
            </span>
          </div>

          {(tieneContacto || proxima.faltan !== null) && (
            <div className="flex flex-none items-center gap-3 md:gap-5">
              {/* Blanco sobre el carbón, y no naranja: el naranja de esta
                  página es una acción de la cabecera, y aquí hay uno solo. */}
              {tieneContacto && (
                <BotonEnlace
                  nativo
                  href="#contacto"
                  variant="outline"
                  className="border-transparent bg-surface text-foreground hover:bg-surface-alt hover:text-foreground md:order-2"
                >
                  <MapPin strokeWidth={1.8} />
                  Cómo llegar
                </BotonEnlace>
              )}
              {/* Solo si es hoy. «Empieza en 41 h» para el domingo no lo
                  lee nadie como cuenta atrás: para eso ya pone «este domingo». */}
              {proxima.faltan !== null && (
                <span
                  className={clsx(
                    'text-label tabular-nums text-support-muted-foreground md:order-1',
                    tieneContacto && 'ml-auto md:ml-0',
                  )}
                >
                  {textoCuentaAtras(proxima.faltan)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {hayDias && (
        <>
          <TiraSemana dias={dias} hoy={hoy} />
          <ColumnasSemana dias={dias} hoy={hoy} />
        </>
      )}

      {/* Lo que tiene un día que no se entiende («Primer domingo de mes»):
          no se sabe en qué día de la tira ponerlo, pero tampoco se puede
          perder. Es lo que pasaba antes con la lista, que lo enseñaba todo. */}
      {sinDia.length > 0 && (
        <section className="flex flex-col gap-2.5">
          {hayDias && <h3 className="t-micro px-1">Otras reuniones</h3>}
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {sinDia.map((h, i) => (
              <li
                key={`${h.dia}-${h.hora}-${i}`}
                className="flex items-baseline gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
              >
                <span className="w-14 flex-none text-subtitle font-extrabold tabular-nums tracking-[-0.02em]">
                  {h.hora}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body font-semibold">{h.nombre}</span>
                    {h.destacado && <Insignia tono="marca">Ven aquí</Insignia>}
                  </span>
                  <span className="text-pretty text-label text-muted-foreground">
                    {h.dia}
                    {h.detalle ? ` · ${h.detalle}` : ''}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type PropsSemana = {
  dias: HorarioSemanal[][];
  hoy: ReturnType<typeof hoyEnLaIglesia>;
};

/**
 * El móvil: la tira de la semana con un indicador que se desliza, y debajo las
 * reuniones del día elegido. Empieza en hoy.
 *
 * Pestañas de verdad para un lector de pantalla (`tablist`, `tab`,
 * `aria-selected`) y con las flechas del teclado, que es lo que se espera de
 * una fila de pestañas: el Tab entra y sale de la tira de un salto, y las
 * flechas se mueven por los días.
 */
function TiraSemana({ dias, hoy }: PropsSemana) {
  const base = useId();
  const tira = useRef<HTMLDivElement>(null);
  // `null` es «el día de hoy», y no la columna de hoy guardada: si la página
  // sigue abierta a medianoche, la tira pasa sola al día siguiente mientras
  // nadie haya elegido otro.
  const [elegido, setElegido] = useState<number | null>(null);
  const columna = elegido ?? hoy.columna;
  const reuniones = dias[columna]!;
  const siguiente = reuniones.length === 0 ? siguienteTras(dias, columna) : null;

  const elegir = (c: number, enfocar = false) => {
    setElegido(c);
    if (enfocar) tira.current?.querySelectorAll<HTMLElement>('[role="tab"]')[c]?.focus();
  };

  const conTeclado = (e: KeyboardEvent<HTMLDivElement>) => {
    const destino =
      e.key === 'ArrowRight'
        ? (columna + 1) % 7
        : e.key === 'ArrowLeft'
          ? (columna + 6) % 7
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? 6
              : null;
    if (destino === null) return;
    e.preventDefault();
    elegir(destino, true);
  };

  return (
    <div className="flex flex-col gap-3 lg:hidden">
      <div
        ref={tira}
        role="tablist"
        aria-label="Días de la semana"
        onKeyDown={conTeclado}
        className="relative grid grid-cols-7 gap-0.5 rounded-xl border border-border bg-surface p-1"
      >
        {/* El indicador: un séptimo del ancho útil (menos el relleno de 4 px
            a cada lado y los seis huecos de 2 px), y se mueve su propio ancho
            más un hueco por cada día. */}
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 rounded-lg bg-accent transition-transform duration-240 ease-hatril motion-reduce:transition-none"
          style={{
            width: 'calc((100% - 20px) / 7)',
            transform: `translateX(calc(${columna} * (100% + 2px)))`,
          }}
        />
        {COLUMNAS.map((c, i) => {
          const elegida = i === columna;
          const esHoy = i === hoy.columna;
          const cuantas = dias[i]!.length;
          return (
            <button
              key={c.corta}
              type="button"
              role="tab"
              id={`${base}-dia-${i}`}
              aria-selected={elegida}
              aria-controls={`${base}-panel`}
              tabIndex={elegida ? 0 : -1}
              aria-label={`${esHoy ? 'Hoy, ' : ''}${c.nombre} ${hoy.fechas[i]}: ${
                cuantas === 0 ? 'sin reuniones' : cuantas === 1 ? 'una reunión' : `${cuantas} reuniones`
              }`}
              onClick={() => elegir(i)}
              className={clsx(
                'relative z-[1] flex cursor-pointer flex-col items-center gap-0.5 rounded-lg pt-1.5 pb-2 outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
                elegida ? 'text-accent-foreground' : 'text-muted-foreground',
              )}
            >
              <span className="text-micro font-semibold uppercase">
                {esHoy ? 'Hoy' : c.corta}
              </span>
              <span
                className={clsx(
                  'text-body font-bold tabular-nums',
                  elegida ? 'text-accent-foreground' : 'text-foreground',
                )}
              >
                {hoy.fechas[i]}
              </span>
              {/* El punto de los días con reunión. Naranja porque así se
                  aprobó: es lo que dice «aquí hay algo» antes de tocar. */}
              <span
                aria-hidden
                className={clsx('size-[5px] rounded-full', cuantas > 0 ? 'bg-primary' : 'bg-transparent')}
              />
            </button>
          );
        })}
      </div>

      {/* `key` con el día: al cambiar, el panel se monta de nuevo y entra con
          el gesto común en vez de cambiar de golpe. */}
      <div
        key={columna}
        role="tabpanel"
        id={`${base}-panel`}
        aria-labelledby={`${base}-dia-${columna}`}
        tabIndex={0}
        className="anim-aparece rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        {reuniones.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {reuniones.map((h, i) => (
              <li
                key={`${h.hora}-${h.nombre}-${i}`}
                className="grid grid-cols-[60px_minmax(0,1fr)] items-start gap-3 rounded-xl border border-border bg-surface p-4"
              >
                <span className="text-subtitle font-extrabold leading-snug tabular-nums tracking-[-0.02em]">
                  {h.hora}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-body font-semibold leading-snug">{h.nombre}</span>
                    {h.destacado && <Insignia tono="marca">Ven aquí</Insignia>}
                  </span>
                  {h.detalle && (
                    <span className="text-pretty text-label leading-relaxed text-muted-foreground">
                      {h.detalle}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border-strong px-4 py-3.5 text-pretty text-label leading-relaxed text-muted-foreground">
            Este día no hay reunión.
            {siguiente && (
              <>
                {' '}La siguiente es{' '}
                <strong className="font-semibold text-foreground">
                  {siguiente.horario.nombre}
                </strong>
                , el {COLUMNAS[siguiente.columna]!.nombre} a las {siguiente.horario.hora}.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

/** Escritorio: los siete días en columnas, todo a la vista. */
function ColumnasSemana({ dias, hoy }: PropsSemana) {
  return (
    <div className="hidden grid-cols-7 gap-3 lg:grid">
      {COLUMNAS.map((c, i) => {
        const esHoy = i === hoy.columna;
        return (
          <section key={c.corta} aria-label={`${c.nombre} ${hoy.fechas[i]}`} className="flex min-w-0 flex-col gap-2.5">
            <h3
              className={clsx(
                'flex h-9 items-center justify-between gap-2 rounded-lg px-3',
                esHoy ? 'bg-accent text-accent-foreground' : 'text-muted-foreground',
              )}
            >
              <span className="truncate text-label font-bold uppercase tracking-[0.06em]">
                {esHoy ? 'Hoy' : c.nombre.slice(0, 3)}
              </span>
              <span
                className={clsx(
                  'text-body font-bold tabular-nums',
                  esHoy ? 'text-accent-foreground' : 'text-foreground',
                )}
              >
                {hoy.fechas[i]}
              </span>
            </h3>

            {dias[i]!.length > 0 ? (
              dias[i]!.map((h, k) => (
                <div
                  key={`${h.hora}-${h.nombre}-${k}`}
                  className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4"
                >
                  <span className="t-titulo tabular-nums">{h.hora}</span>
                  <span className="text-pretty text-body font-semibold leading-snug">{h.nombre}</span>
                  {h.destacado && (
                    <Insignia tono="marca" className="self-start">
                      Ven aquí
                    </Insignia>
                  )}
                  {h.detalle && (
                    <span className="text-pretty text-label leading-relaxed text-muted-foreground">
                      {h.detalle}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-xl border border-dashed border-border px-3 py-5 text-center text-label text-muted-foreground">
                Sin reunión
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
