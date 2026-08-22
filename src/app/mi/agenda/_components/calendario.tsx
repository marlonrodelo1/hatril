'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Church, Users } from 'lucide-react';

import type { Ocurrencia, TipoDeDia } from '@/lib/agenda/calendario';
import { Hoja } from '@/components/hoja';

/**
 * La rejilla del mes, con los días marcados y su hoja al tocarlos.
 *
 * SIN LIBRERÍA DE CALENDARIO, Y NO POR AHORRAR
 * --------------------------------------------
 * Un calendario de mes son siete columnas y un bucle. Las librerías del ramo
 * traen selección de rango, arrastrar eventos, vistas de agenda y localización
 * —cuarenta o sesenta kilobytes de JavaScript— para resolver problemas que esta
 * pantalla no tiene. Y la que más se usa monta su propio sistema de estilos, que
 * habría que domar para que no desentone con las otras cuarenta pantallas.
 *
 * ES DE CLIENTE, PERO NO TRAE DATOS
 * ---------------------------------
 * El mes entero llega ya resuelto del servidor. Aquí solo vive qué día está
 * abierto, que es lo único que no se puede saber sin un dedo. Tocar un día no
 * pide nada a la red: la hoja se abre con lo que ya está en memoria.
 *
 * LA SEMANA EMPIEZA EN LUNES
 * --------------------------
 * `getUTCDay()` numera el domingo como 0 porque viene del inglés. En España y en
 * Colombia la semana empieza el lunes, así que se recoloca. Es un error de una
 * sola línea que descoloca la rejilla entera y se ve enseguida — pero solo si se
 * mira un mes que no empiece en domingo.
 */

const DIAS_CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const ICONOS: Record<TipoDeDia, React.ElementType> = {
  culto: Church,
  evento: CalendarDays,
  ministerio: Users,
};

/** El punto de color de cada tipo, para la rejilla. */
const PUNTOS: Record<TipoDeDia, string> = {
  culto: 'bg-support-active',
  evento: 'bg-primary',
  ministerio: 'bg-badge-warning-fg',
};

export function CalendarioMes({
  dias,
  mes,
  hoy,
  ocurrencias,
}: {
  /** Los `YYYY-MM-DD` de la rejilla, incluidos los arrastres del mes vecino. */
  dias: string[];
  /** `YYYY-MM` del mes que se está mirando, para apagar los arrastres. */
  mes: string;
  hoy: string;
  /** Todo lo del rango, agrupado por día. */
  ocurrencias: Record<string, Ocurrencia[]>;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);

  const delDia = abierto ? (ocurrencias[abierto] ?? []) : [];

  return (
    <>
      <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2 sm:p-3">
        <div className="grid grid-cols-7">
          {DIAS_CABECERA.map((d, i) => (
            <span
              key={i}
              className="py-1 text-center text-[11px] font-semibold uppercase text-muted-foreground"
            >
              {d}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-0.5">
          {dias.map((f) => {
            const cosas = ocurrencias[f] ?? [];
            const esDeOtroMes = !f.startsWith(mes);
            const esHoy = f === hoy;

            // Los tipos que hay ese día, sin repetir: tres puntos como mucho.
            const tipos = [...new Set(cosas.map((c) => c.tipo))];

            return (
              <button
                key={f}
                type="button"
                onClick={() => setAbierto(f)}
                aria-label={`${Number(f.slice(8))}, ${cosas.length} ${cosas.length === 1 ? 'actividad' : 'actividades'}`}
                className={
                  'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-[13.5px] tabular-nums outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/20 ' +
                  (esHoy
                    ? 'bg-primary font-bold text-white'
                    : esDeOtroMes
                      ? 'text-disabled-text hover:bg-surface-alt'
                      : cosas.length
                        ? 'cursor-pointer font-semibold text-foreground hover:bg-surface-alt'
                        : 'text-muted-foreground hover:bg-surface-alt')
                }
              >
                {Number(f.slice(8))}

                {/* Los puntos van SIEMPRE en su fila, con o sin nada ese día:
                    sin el hueco reservado, los números bailan de línea entre un
                    día con actividad y uno sin ella. */}
                <span className="flex h-1.5 items-center gap-0.5">
                  {tipos.map((t) => (
                    <span
                      key={t}
                      className={
                        'size-1.5 rounded-full ' +
                        (esHoy ? 'bg-white/80' : PUNTOS[t])
                      }
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Hoja
        abierta={abierto !== null}
        onCambio={(v) => !v && setAbierto(null)}
        titulo={abierto ? tituloDelDia(abierto) : ''}
        descripcion="Lo que hay ese día en la iglesia."
      >
        {delDia.length === 0 ? (
          <p className="py-6 text-center text-[14.5px] text-muted-foreground">
            No hay nada ese día.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {delDia.map((o, i) => (
              <li key={i}>
                <FilaOcurrencia ocurrencia={o} />
              </li>
            ))}
          </ul>
        )}
      </Hoja>
    </>
  );
}

/**
 * Una cosa del día. Enlace si lleva a algún sitio, y si no, una fila muerta.
 *
 * El culto del domingo no tiene ficha a la que ir: es una línea del cuadro de
 * horarios. Pintarlo como enlace prometería una pantalla que no existe.
 */
export function FilaOcurrencia({ ocurrencia: o }: { ocurrencia: Ocurrencia }) {
  const Icono = ICONOS[o.tipo];

  const cuerpo = (
    <>
      <span
        className="flex size-9 flex-none items-center justify-center rounded-lg"
        style={
          o.color
            ? { backgroundColor: 'rgb(255 255 255 / 0.06)', color: o.color }
            : undefined
        }
      >
        <Icono
          className={'size-[18px] ' + (o.color ? '' : colorDeTipo(o.tipo))}
          strokeWidth={1.8}
        />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[14.5px] font-semibold">{o.titulo}</span>
        {o.detalle && (
          <span className="truncate text-[13px] text-muted-foreground">
            {o.detalle}
          </span>
        )}
      </span>

      <span className="flex-none text-[13px] font-semibold tabular-nums text-muted-foreground">
        {o.hora ?? 'Todo el día'}
      </span>
    </>
  );

  const clases =
    'flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5';

  return o.enlace ? (
    <Link
      href={o.enlace}
      className={clases + ' text-foreground no-underline hover:bg-surface-alt hover:no-underline'}
    >
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

function colorDeTipo(t: TipoDeDia): string {
  return t === 'culto'
    ? 'text-badge-success-fg'
    : t === 'evento'
      ? 'text-badge-accent-fg'
      : 'text-badge-warning-fg';
}

function tituloDelDia(fecha: string): string {
  return new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}
