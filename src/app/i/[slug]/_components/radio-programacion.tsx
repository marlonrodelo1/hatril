'use client';

import { useId, useState } from 'react';
import { clsx } from 'clsx';
import { ChevronDown } from 'lucide-react';

import { DIAS_PARRILLA, type Programa } from '@/lib/emisora/config';
import { franjaDe, parrillaPorDia } from '@/lib/emisora/parrilla';
import { Button } from '@/components/ui/button';
import { Insignia } from '@/components/ui/insignia';

/**
 * La programación de la radio en la web pública: la de hoy a la vista, con lo
 * que suena marcado, y el resto de la semana plegado (zona 3, 17-nov).
 *
 * Antes eran siete cajas por día, todas iguales, y lo que estaba sonando se
 * distinguía por una palabra pequeña. Quien llega quiere saber qué hay ahora y
 * qué viene esta tarde; el jueves que viene lo busca quien lo busca.
 *
 * No usa `ProgramacionSemanal` (`components/radio`) porque esa es la de la
 * hoja del reproductor de `/mi`, en cajas por día, y se comparte. Sí usa lo
 * mismo por debajo, `parrillaPorDia` y `franjaDe`, y tampoco pinta quién
 * presenta: el nombre de un locutor junto al de su iglesia es su confesión
 * publicada en internet.
 */
export function ProgramacionRadio({
  parrilla,
  hoy,
  ahora,
}: {
  parrilla: Programa[];
  hoy: Programa['dia'];
  ahora: Programa | null;
}) {
  const base = useId();
  const [semanaAbierta, setSemanaAbierta] = useState(false);

  const dias = parrillaPorDia(parrilla);
  const deHoy = dias.find((d) => d.dia === hoy)?.programas ?? [];
  // El resto, empezando por mañana: después del lunes, el martes, y el lunes
  // que viene al final. Es el orden en que se van a oír.
  const posHoy = DIAS_PARRILLA.indexOf(hoy);
  const resto = dias
    .filter((d) => d.dia !== hoy)
    .sort(
      (a, b) =>
        ((DIAS_PARRILLA.indexOf(a.dia) - posHoy + 7) % 7) -
        ((DIAS_PARRILLA.indexOf(b.dia) - posHoy + 7) % 7),
    );

  return (
    <div className="flex flex-col gap-3">
      <section aria-labelledby={`${base}-hoy`} className="flex flex-col gap-2">
        <h3 id={`${base}-hoy`} className="t-micro px-1">
          Hoy, {hoy.toLowerCase()}
        </h3>
        {deHoy.length > 0 ? (
          <ListaProgramas programas={deHoy} ahora={ahora} />
        ) : (
          <p className="rounded-lg border border-dashed border-border-strong px-3 py-3 text-label text-muted-foreground">
            Hoy no hay programas en la parrilla.
          </p>
        )}
      </section>

      {resto.length > 0 && (
        <>
          {/* `hidden` y no desmontar: lo que está plegado sigue en la página
              para quien busca con Ctrl+F «domingo». */}
          <div
            id={`${base}-semana`}
            hidden={!semanaAbierta}
            className="anim-aparece flex flex-col gap-3"
          >
            {resto.map(({ dia, programas }) => (
              <section key={dia} aria-labelledby={`${base}-${dia}`} className="flex flex-col gap-2">
                <h3 id={`${base}-${dia}`} className="t-micro px-1">
                  {dia}
                </h3>
                <ListaProgramas programas={programas} ahora={ahora} />
              </section>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={semanaAbierta}
            aria-controls={`${base}-semana`}
            onClick={() => setSemanaAbierta((v) => !v)}
            className="self-start"
          >
            {semanaAbierta ? 'Solo hoy' : 'Toda la semana'}
            <ChevronDown
              strokeWidth={1.8}
              aria-hidden
              className={clsx(
                'transition-transform duration-240 ease-hatril motion-reduce:transition-none',
                semanaAbierta && 'rotate-180',
              )}
            />
          </Button>
        </>
      )}
    </div>
  );
}

function ListaProgramas({
  programas,
  ahora,
}: {
  programas: Programa[];
  ahora: Programa | null;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {programas.map((p, i) => {
        // Por identidad: `useAhora` devuelve el mismo objeto de la parrilla.
        const suena = ahora === p;
        return (
          <li
            // Con el índice: la base no impide dos filas iguales, y una clave
            // repetida en una lista que se repinta cada medio minuto acaba
            // pintando la fila que no es.
            key={`${p.hora}-${p.nombre}-${i}`}
            className={clsx(
              'flex items-start gap-3 rounded-lg border px-3 py-2.5',
              suena ? 'border-danger-border bg-danger-soft' : 'border-border bg-surface',
            )}
          >
            {/* «Ahora» debajo de la franja y no a la derecha, como en la
                maqueta: a 375 px le quitaba al nombre el ancho de la insignia
                y «Alabanza de la tarde» salía en tres renglones. Así la
                columna de la izquierda dice cuándo, y si es ya. */}
            <span className="flex w-[104px] flex-none flex-col items-start gap-1.5">
              <span
                className={clsx(
                  'text-label font-bold leading-snug tabular-nums',
                  suena ? 'text-badge-danger-fg' : 'text-muted-foreground',
                )}
              >
                {franjaDe(p)}
              </span>
              {suena && (
                <Insignia tono="peligro" vivo>
                  Ahora
                </Insignia>
              )}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold leading-snug">{p.nombre}</span>
              {p.tema && (
                <span className="text-pretty text-label leading-snug text-muted-foreground">
                  {p.tema}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
