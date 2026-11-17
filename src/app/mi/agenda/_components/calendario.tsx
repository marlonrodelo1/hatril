'use client';

import { useState } from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';

import type { Ocurrencia } from '@/lib/agenda/calendario';
import { Hoja } from '@/components/hoja';
import { COLOR_DE_TIPO, LEYENDA, ordenarDelDia } from './tipos-del-dia';

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

  const delDia = abierto ? ordenarDelDia(ocurrencias[abierto] ?? []) : [];

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-2 sm:p-3">
          <div className="grid grid-cols-7">
            {DIAS_CABECERA.map((d, i) => (
              <span
                key={i}
                className="py-1 text-center text-micro font-bold text-muted-foreground"
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

              // Los tipos que hay ese día, sin repetir y en el orden de la
              // leyenda: cuatro puntos como mucho, y siempre en el mismo sitio,
              // para que el naranja de un turno se encuentre sin buscarlo.
              const tipos = LEYENDA.map((l) => l.tipo).filter((t) =>
                cosas.some((c) => c.tipo === t),
              );

              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setAbierto(f)}
                  aria-label={`${Number(f.slice(8))}, ${cosas.length} ${cosas.length === 1 ? 'actividad' : 'actividades'}`}
                  className={clsx(
                    'flex aspect-square flex-col items-center justify-center gap-1 rounded-lg text-label tabular-nums outline-none transition-colors duration-150 focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none',
                    esHoy
                      ? 'bg-primary font-bold text-primary-foreground'
                      : esDeOtroMes
                        ? 'text-disabled-text hover:bg-surface-alt'
                        : cosas.length
                          ? 'cursor-pointer font-semibold text-foreground hover:bg-surface-alt'
                          : 'text-muted-foreground hover:bg-surface-alt',
                  )}
                >
                  {Number(f.slice(8))}

                  {/* Los puntos van SIEMPRE en su fila, con o sin nada ese día:
                      sin el hueco reservado, los números bailan de línea entre
                      un día con actividad y uno sin ella. */}
                  <span aria-hidden className="flex h-1.5 items-center gap-0.5">
                    {tipos.map((t) => (
                      <span
                        key={t}
                        className={clsx(
                          'size-1.5 rounded-full',
                          // Sobre el naranja de hoy, el punto del turno sería
                          // naranja sobre naranja: todos van en la letra del
                          // relleno, que es el mismo blanco del número.
                          esHoy ? 'bg-primary-foreground' : COLOR_DE_TIPO[t],
                        )}
                      />
                    ))}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* La leyenda, debajo y fuera de la tarjeta, como un pie de figura. */}
        <ul
          aria-label="Qué es cada color"
          className="flex flex-wrap gap-x-3 gap-y-1.5 px-1 text-micro text-muted-foreground"
        >
          {LEYENDA.map((l) => (
            <li key={l.tipo} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden
                className={clsx('size-[7px] rounded-full', COLOR_DE_TIPO[l.tipo])}
              />
              {l.texto}
            </li>
          ))}
        </ul>
      </div>

      <Hoja
        abierta={abierto !== null}
        onCambio={(v) => !v && setAbierto(null)}
        titulo={abierto ? tituloDelDia(abierto) : ''}
        descripcion="Lo que hay ese día en la iglesia."
      >
        {delDia.length === 0 ? (
          <p className="py-6 text-center text-body text-muted-foreground">
            No hay nada ese día.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {delDia.map((o, i) => (
              <li
                key={i}
                className="anim-aparece"
                // Una detrás de otra al subir la hoja: se lee de arriba abajo,
                // como se lee el día. Con «reducir movimiento», todas a la vez.
                style={{ '--retraso': `${Math.min(i, 6) * 40}ms` } as React.CSSProperties}
              >
                <FilaOcurrencia ocurrencia={o} enHoja />
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
 *
 * LA MARCA DE COLOR EN VEZ DEL ICONO
 * ----------------------------------
 * Llevaba un cuadrado con un icono por tipo, cada uno en un color distinto del
 * de su punto en la rejilla: el evento era un punto azul y un icono naranja.
 * Ahora es una raya vertical del MISMO color que el punto y que la leyenda, y
 * la fila se reconoce de un vistazo sin aprender dos claves.
 *
 * `enHoja`: dentro de la hoja la fila baja a radio 8, porque la hoja ya es la
 * tarjeta y la regla del sistema es no anidar dos radios de 12.
 */
export function FilaOcurrencia({
  ocurrencia: o,
  enHoja = false,
}: {
  ocurrencia: Ocurrencia;
  enHoja?: boolean;
}) {
  const cuerpo = (
    <>
      <span
        aria-hidden
        className={clsx('w-1 flex-none self-stretch rounded-full', COLOR_DE_TIPO[o.tipo])}
      />

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body font-semibold">{o.titulo}</span>
        {o.detalle && (
          <span className="truncate text-label text-muted-foreground">
            {o.detalle}
          </span>
        )}
      </span>

      <span className="flex-none text-label font-bold tabular-nums text-foreground">
        {o.hora ?? 'Todo el día'}
      </span>
    </>
  );

  const clases = clsx(
    'flex items-center gap-3 border border-border bg-surface px-3 py-2.5',
    enHoja ? 'rounded-lg' : 'rounded-xl',
  );

  return o.enlace ? (
    <Link
      href={o.enlace}
      className={clsx(
        clases,
        // Regla 11: un enlace con forma de fila lleva el color del texto, o
        // hereda el naranja que `globals.css` le da a todo `<a>`.
        'text-foreground no-underline transition-colors duration-150 hover:bg-surface-alt hover:text-foreground hover:no-underline motion-reduce:transition-none',
      )}
    >
      {cuerpo}
    </Link>
  ) : (
    <div className={clases}>{cuerpo}</div>
  );
}

/**
 * «Jueves 19 de noviembre», ya con mayúscula: el título de la hoja no admite
 * una clase, así que no vale el `first-letter:uppercase` de las otras fechas.
 */
function tituloDelDia(fecha: string): string {
  const d = new Date(fecha + 'T12:00:00Z');
  const dia = d.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' });
  const mes = d.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' });
  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getUTCDate()} de ${mes}`;
}
