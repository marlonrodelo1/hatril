import Link from 'next/link';
import { ChevronRight, TriangleAlert } from 'lucide-react';

import type { CuentaDeLaRed, GrupoDeLaRed } from '@/lib/grupos/consultas';
import type { EtiquetasDeGrupos } from '@/lib/grupos/etiquetas';
import { mayuscula } from '@/lib/grupos/etiquetas';
import { cuandoSeReune, diaYMes, nombreDelDia } from '@/lib/grupos/semanas';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
// La insignia de la guía visual vive en la zona de equipos hasta la fase 2
// (`components/ui/insignia.tsx`); se usa la misma para que panel y app pinten
// lo mismo con la misma pastilla.
import { Insignia } from '@/app/mi/equipo/_components/insignia';

/**
 * Las piezas de la red que se ven igual en el panel y en la app: cómo va, la
 * lista de grupos y la guía de la semana.
 *
 * Aquí y no en cada pantalla porque las dos puertas —el responsable en el
 * ordenador y el colíder en el móvil— tienen que contar lo mismo con las mismas
 * palabras. Sin `server-only`, pero sin estado: son componentes de servidor que
 * reciben los datos ya leídos y la action ya atada.
 */

/** La insignia de la última reunión de un grupo. Lo urgente, con icono. */
export function EstadoDeLaReunion({
  grupo,
  hoy,
}: {
  grupo: Pick<GrupoDeLaRed, 'reunion' | 'diaSemana'>;
  hoy: string;
}) {
  const r = grupo.reunion;
  switch (r.estado) {
    case 'reportada':
      return <Insignia tono="exito">Reportada</Insignia>;
    case 'no_hubo':
      return <Insignia tono="neutro">No hubo reunión</Insignia>;
    case 'hoy':
      return <Insignia tono="marca">Hoy</Insignia>;
    case 'sin_empezar':
      return <Insignia tono="neutro">Empieza el {nombreDelDia(grupo.diaSemana)}</Insignia>;
    case 'sin_reportar':
      return (
        <Insignia tono="aviso" Icono={TriangleAlert}>
          {diaCorto(r.fecha, hoy)} sin reportar
        </Insignia>
      );
  }
}

/**
 * Cómo va la red: cuántas reportaron su última reunión, cuántos vinieron y
 * cuántas visitas. Una tarjeta con las cifras de Inicio (`t-cifra`), sin color:
 * una cifra no pide nada. Lo que pide, que es cuántas faltan, va en la línea de
 * abajo con su icono.
 */
export function CuentaDeLaRedTarjeta({
  cuenta,
  etiquetas: e,
}: {
  cuenta: CuentaDeLaRed;
  etiquetas: EtiquetasDeGrupos;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="grid grid-cols-3 gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-micro">Reportaron</span>
          <span className="flex flex-wrap items-baseline gap-x-1">
            <span className="t-cifra tabular-nums">{cuenta.reportados}</span>
            <span className="whitespace-nowrap text-label font-semibold text-muted-foreground">
              de {cuenta.total}
            </span>
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-micro">Vinieron</span>
          <span className="t-cifra tabular-nums">{cuenta.asistentes}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="t-micro">Visitas</span>
          <span className="t-cifra tabular-nums">{cuenta.visitas}</span>
        </div>
      </div>
      <p className="text-pretty text-label text-muted-foreground">
        De la última reunión de cada {e.uno}: la de esta semana si ya pasó su día,
        y si no, la de la anterior.
        {cuenta.noHubo > 0 && ` En ${cuenta.noHubo} no hubo reunión.`}
        {/* Fuera de la cuenta hasta que la reporten: contarlas sin sus cifras
            hacía parecer peor a la red cada día de reunión (`contarLaRed`). */}
        {cuenta.hoy > 0 &&
          (cuenta.hoy === 1
            ? ` 1 se reúne hoy y entra en la cuenta cuando la reporte.`
            : ` ${cuenta.hoy} se reúnen hoy y entran en la cuenta cuando las reporten.`)}
      </p>
      {cuenta.sinReportar > 0 && (
        <p className="flex items-center gap-2 text-body font-semibold text-badge-warning-fg">
          <TriangleAlert className="size-4 flex-none" strokeWidth={1.8} aria-hidden />
          {cuenta.sinReportar === 1
            ? `1 ${e.uno} sin reportar`
            : `${cuenta.sinReportar} ${e.varios} sin reportar`}
        </p>
      )}
    </section>
  );
}

/** La lista de grupos de la red. La fila entera lleva a su ficha. */
export function ListaDeLaRed({
  grupos,
  hoy,
  hrefDe,
}: {
  grupos: GrupoDeLaRed[];
  hoy: string;
  hrefDe: (grupoId: string) => string;
}) {
  return (
    <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      {grupos.map((g) => {
        const lider = g.lider
          ? g.lider.enEquipo
            ? `Lleva ${g.lider.nombre}`
            : `${g.lider.nombre} ya no está en el equipo`
          : 'Sin líder';
        const datos = [
          cuandoSeReune(g.diaSemana, g.hora),
          g.zona,
          g.integrantes === 1 ? '1 persona' : `${g.integrantes} personas`,
        ]
          .filter(Boolean)
          .join(' · ');
        const cifras =
          g.reunion.estado === 'reportada'
            ? `Vinieron ${g.reunion.asistentes}${g.reunion.visitas ? ` y ${g.reunion.visitas} de visita` : ''}`
            : null;

        return (
          <li key={g.id} className="border-b border-border last:border-b-0">
            <Link
              href={hrefDe(g.id)}
              className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="text-body font-semibold">{g.nombre}</span>
                  <EstadoDeLaReunion grupo={g} hoy={hoy} />
                </span>
                <span className="text-label text-muted-foreground">
                  {[lider, cifras].filter(Boolean).join(' · ')}
                </span>
                <span className="text-label text-muted-foreground">{datos}</span>
              </span>
              <ChevronRight
                className="size-4 flex-none text-disabled-text"
                strokeWidth={1.8}
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * La guía común de la semana: un tema por cada una de las próximas semanas,
 * para toda la red.
 *
 * Se propone en cada grupo que no tenga el suyo: en el reporte y en sus
 * próximas semanas. No obliga a nada, y lo dice. El botón lo elige la pantalla:
 * naranja donde es la acción de la pantalla, de contorno donde ya hay otra.
 */
export function GuiaDeLaRed({
  accion,
  semanas,
  guias,
  hoy,
  etiquetas: e,
  boton = 'default',
}: {
  accion: (formData: FormData) => Promise<void>;
  /** Los lunes, desde el de esta semana. */
  semanas: string[];
  guias: Map<string, string>;
  hoy: string;
  etiquetas: EtiquetasDeGrupos;
  boton?: 'default' | 'outline';
}) {
  return (
    <section id="guia" className="flex scroll-mt-20 flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">Guía de la semana</h2>
        <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
          El tema que {e.laRed} propone a {e.todos}. Cada líder lo ve al reportar y
          al planificar, y si escribe otro para su {e.uno}, manda el suyo. Vacío,
          no se propone nada esa semana.
        </p>
      </div>

      <form action={accion} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {semanas.map((s, i) => (
            <div key={s} className="flex flex-col gap-1.5">
              <label htmlFor={`tema-${s}`} className="text-label font-semibold">
                {i === 0 && s <= hoy ? 'Esta semana' : `Semana del ${diaYMes(s)}`}
              </label>
              <Input
                id={`tema-${s}`}
                name={`tema-${s}`}
                maxLength={120}
                defaultValue={guias.get(s) ?? ''}
                placeholder="p. ej. El perdón, Mateo 18"
                autoComplete="off"
              />
            </div>
          ))}
        </div>
        <Button type="submit" variant={boton} className="w-fit">
          Guardar la guía
        </Button>
      </form>
    </section>
  );
}

/** El estado vacío de la red: qué es esto y qué hacer. */
export function RedVacia({
  etiquetas: e,
  accion,
}: {
  etiquetas: EtiquetasDeGrupos;
  accion?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
      <h2 className="t-subtitulo">{e.estaRed} todavía no tiene {e.varios}</h2>
      <p className="max-w-[56ch] text-pretty text-body leading-relaxed text-muted-foreground">
        {mayuscula(e.uno)} a {e.uno}: su nombre, el día y la hora, la zona y su
        líder, elegido entre el equipo. Después se suma a su gente o se comparte su
        enlace de invitación.
      </p>
      {accion}
    </div>
  );
}
