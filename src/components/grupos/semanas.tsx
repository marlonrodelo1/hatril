import Link from 'next/link';
import { ChevronRight, TriangleAlert } from 'lucide-react';

import type { SemanaGuardada } from '@/lib/grupos/consultas';
import { fechaDeLaReunion, semanasAnteriores } from '@/lib/grupos/semanas';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { Insignia } from '@/app/mi/equipo/_components/insignia';

/**
 * Las últimas semanas de un grupo, de la más reciente hacia atrás.
 *
 * Lo que se reportó, con sus cifras y su tema; lo que no, dicho con icono. En
 * la pantalla de quien lleva el grupo, una semana sin reportar es un enlace a
 * reportarla (`hrefReportar`); en el panel, solo se lee.
 */
export function SemanasAnteriores({
  diaSemana,
  alta,
  hoy,
  guardadas,
  cuantas = 6,
  hrefReportar,
}: {
  diaSemana: number;
  /** El día en que se creó el grupo: antes no hay nada que pedir. */
  alta: string;
  hoy: string;
  guardadas: Map<string, SemanaGuardada>;
  cuantas?: number;
  hrefReportar?: (semana: string) => string;
}) {
  const semanas = semanasAnteriores(diaSemana, hoy, cuantas).filter(
    (s) => fechaDeLaReunion(s, diaSemana) >= alta || guardadas.has(s),
  );

  if (semanas.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
        Todavía no ha tenido ninguna reunión desde que se creó.
      </p>
    );
  }

  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {semanas.map((s) => {
        const fecha = fechaDeLaReunion(s, diaSemana);
        const g = guardadas.get(s);
        const reportada = g && g.estado !== 'prevista';
        const pendiente = !reportada && fecha < hoy;

        const linea =
          g?.estado === 'celebrada'
            ? [
                `Vinieron ${g.asistentes}`,
                g.visitas ? `${g.visitas} de visita` : null,
                g.tema ? `Tema: ${g.tema}` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            : g?.estado === 'no_hubo'
              ? 'No hubo reunión'
              : fecha === hoy
                ? 'Es hoy: se reporta al acabar'
                : 'Nadie la ha reportado';

        const contenido = (
          <>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-body font-semibold">{diaCorto(fecha, hoy)}</span>
              <span className="text-pretty text-label text-muted-foreground">{linea}</span>
            </span>
            {pendiente && (
              <Insignia tono="aviso" Icono={TriangleAlert}>
                Sin reportar
              </Insignia>
            )}
            {g?.estado === 'celebrada' && <Insignia tono="exito">Reportada</Insignia>}
          </>
        );

        return (
          <li key={s} className="border-b border-border last:border-b-0">
            {hrefReportar ? (
              <Link
                href={hrefReportar(s)}
                className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
              >
                {contenido}
                <ChevronRight
                  className="size-4 flex-none text-disabled-text"
                  strokeWidth={1.8}
                  aria-hidden
                />
              </Link>
            ) : (
              <div className="flex items-center gap-3 px-4 py-3 md:px-5">{contenido}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
