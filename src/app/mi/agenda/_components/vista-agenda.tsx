import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { Ocurrencia } from '@/lib/agenda/calendario';
import { porDia, sumarDias } from '@/lib/agenda/horarios';
import type { misTurnos } from '@/lib/turnos/consultas';
import { Aviso } from '@/components/aviso';
import { CalendarioMes, FilaOcurrencia } from './calendario';
import { ordenarDelDia } from './tipos-del-dia';
import { Segmentado, type Vista } from './segmentado';
import { TeTocaServir } from './te-toca-servir';
import { CONFIRMACIONES_TURNO } from '../constantes';

/**
 * Lo que pinta la agenda, sin consultar nada.
 *
 * Salió de `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`), cada una con sus datos. El porqué de cada pieza
 * —por qué un rango y dos cosas pintadas, por qué los turnos arriba— está en
 * esa página. `rangoDe` sale de aquí porque la página y la API lo necesitan
 * para saber qué consultar.
 */
export type TurnoPorContestar = Awaited<ReturnType<typeof misTurnos>>[number];

export function VistaAgenda({
  cabecera,
  iglesiaNombre,
  vista,
  ancla,
  hoy,
  lista,
  porContestar,
  error,
  guardado,
}: {
  cabecera: ReactNode;
  iglesiaNombre: string;
  vista: Vista;
  ancla: string;
  hoy: string;
  /** Lo de la vista y las tres semanas de «Próximos», en una sola lista. */
  lista: Ocurrencia[];
  porContestar: TurnoPorContestar[];
  error?: string;
  guardado?: string;
}) {
  const { desde, hasta } = rangoDe(vista, ancla);
  const proximos = lista.filter((o) => o.fecha >= hoy).slice(0, 6);

  // La vista pinta solo lo suyo, aunque se haya traído de más.
  const porFecha = porDia(
    lista.filter((o) => o.fecha >= desde && o.fecha <= hasta),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES_TURNO, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES_TURNO[guardado]}</Aviso>
        )}

        {/* Lo primero de la pantalla, y solo con lo que el cliente pinta: la
            fecha ya compuesta, porque «hoy» es el de la iglesia y eso lo sabe
            el servidor. */}
        {porContestar.length > 0 && (
          <TeTocaServir
            turnos={porContestar.map((t) => ({
              id: t.id,
              cuando: diaDelTurno(t.fecha, hoy),
              hora: t.hora,
              titulo: t.titulo,
              ministerio: t.ministerio.nombre,
              puestos: t.puestos,
              respuesta: t.respuesta,
            }))}
          />
        )}

        <Segmentado vista={vista} ancla={ancla} />

        <Navegacion vista={vista} ancla={ancla} />

        {vista === 'mes' ? (
          <CalendarioMes
            dias={diasDeLaRejilla(ancla)}
            mes={ancla.slice(0, 7)}
            hoy={hoy}
            ocurrencias={Object.fromEntries(porFecha)}
          />
        ) : (
          <ListaDePeriodo desde={desde} hasta={hasta} porFecha={porFecha} hoy={hoy} />
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="t-micro px-1">Próximos</h2>

          {proximos.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-body leading-relaxed text-muted-foreground">
              No hay nada apuntado por aquí. Aparecerán los cultos de{' '}
              {iglesiaNombre}, sus eventos y los ensayos de los equipos en
              los que sirvas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximos.map((o, i) => (
                <li key={i} className="flex flex-col gap-1">
                  {/* El día, solo al cambiar de día. Antes salía encima de
                      cada fila, y con un ensayo y un culto el mismo jueves se
                      leían dos «Jueves, 19 de noviembre» seguidos, como si
                      fueran dos días distintos. */}
                  {(i === 0 || proximos[i - 1]!.fecha !== o.fecha) && (
                    <span className="px-1 text-label font-semibold text-muted-foreground first-letter:uppercase">
                      {diaCorto(o.fecha, hoy)}
                    </span>
                  )}
                  <FilaOcurrencia ocurrencia={o} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

/** El trozo de calendario que hace falta para pintar cada vista. */
export function rangoDe(vista: Vista, ancla: string): { desde: string; hasta: string } {
  if (vista === 'dia') return { desde: ancla, hasta: ancla };

  if (vista === 'semana') {
    const lunes = lunesDe(ancla);
    return { desde: lunes, hasta: sumarDias(lunes, 6) };
  }

  const rejilla = diasDeLaRejilla(ancla);
  return { desde: rejilla[0]!, hasta: rejilla[rejilla.length - 1]! };
}

/**
 * El lunes de la semana de una fecha.
 *
 * `getUTCDay()` da 0 al domingo porque viene del inglés; aquí la semana empieza
 * en lunes, así que el domingo cuenta como el día 6 y no como el 0. Es el error
 * clásico de los calendarios y solo se ve al mirar una semana que cruza mes.
 */
function lunesDe(fecha: string): string {
  const dow = new Date(fecha + 'T00:00:00Z').getUTCDay();
  return sumarDias(fecha, -((dow + 6) % 7));
}

/**
 * Las seis semanas de la rejilla del mes.
 *
 * Seis y no «las que hagan falta»: un mes ocupa cinco semanas o seis según en
 * qué día caiga el 1, y una rejilla que cambia de alto hace saltar todo lo que
 * tiene debajo al pasar de mes. Con seis fijas, el calendario mide siempre lo
 * mismo.
 */
function diasDeLaRejilla(ancla: string): string[] {
  const primero = ancla.slice(0, 8) + '01';
  const inicio = lunesDe(primero);
  return Array.from({ length: 42 }, (_, i) => sumarDias(inicio, i));
}

/** Atrás, el periodo que se está mirando, y adelante. */
function Navegacion({ vista, ancla }: { vista: Vista; ancla: string }) {
  const salto = vista === 'dia' ? 1 : vista === 'semana' ? 7 : 0;

  const anterior =
    salto > 0 ? sumarDias(ancla, -salto) : mesVecino(ancla, -1);
  const siguiente = salto > 0 ? sumarDias(ancla, salto) : mesVecino(ancla, 1);

  return (
    <div className="flex items-center gap-2">
      <Paso href={`/mi/agenda?v=${vista}&d=${anterior}`} etiqueta="Anterior">
        <ChevronLeft className="size-[18px]" strokeWidth={1.8} />
      </Paso>

      <span className="flex-1 text-center text-body font-bold tracking-[-0.01em] first-letter:uppercase">
        {tituloDelPeriodo(vista, ancla)}
      </span>

      <Paso href={`/mi/agenda?v=${vista}&d=${siguiente}`} etiqueta="Siguiente">
        <ChevronRight className="size-[18px]" strokeWidth={1.8} />
      </Paso>
    </div>
  );
}

function Paso({
  href,
  etiqueta,
  children,
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-label={etiqueta}
      className="flex size-9 flex-none items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground no-underline transition-colors duration-150 hover:bg-surface-alt hover:text-foreground hover:no-underline motion-reduce:transition-none"
    >
      {children}
    </Link>
  );
}

/**
 * El primero del mes de al lado.
 *
 * Se usa el día 1 y no `ancla` para saltar de mes: sumar un mes al 31 de enero
 * da el 3 de marzo, que es el error de calendario más viejo que hay.
 */
function mesVecino(ancla: string, salto: number): string {
  const d = new Date(ancla.slice(0, 8) + '01T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + salto);
  return d.toISOString().slice(0, 10);
}

function ListaDePeriodo({
  desde,
  hasta,
  porFecha,
  hoy,
}: {
  desde: string;
  hasta: string;
  porFecha: Map<string, Ocurrencia[]>;
  hoy: string;
}) {
  const dias: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) dias.push(f);

  const conAlgo = dias.filter((f) => (porFecha.get(f) ?? []).length > 0);

  if (conAlgo.length === 0) {
    return (
      <p className="rounded-xl border border-border bg-surface p-5 text-body text-muted-foreground">
        {dias.length === 1
          ? 'No hay nada ese día.'
          : 'No hay nada esa semana.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {conAlgo.map((f) => (
        <section key={f} className="flex flex-col gap-2">
          <h3 className="px-1 text-label font-semibold text-muted-foreground first-letter:uppercase">
            {diaCorto(f, hoy)}
          </h3>
          <ul className="flex flex-col gap-2">
            {ordenarDelDia(porFecha.get(f) ?? []).map((o, i) => (
              <li key={i}>
                <FilaOcurrencia ocurrencia={o} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function tituloDelPeriodo(vista: Vista, ancla: string): string {
  const d = new Date(ancla + 'T12:00:00Z');

  if (vista === 'dia') {
    return d.toLocaleDateString('es-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });
  }

  if (vista === 'semana') {
    const lunes = lunesDe(ancla);
    const domingo = sumarDias(lunes, 6);
    const a = new Date(lunes + 'T12:00:00Z');
    const b = new Date(domingo + 'T12:00:00Z');
    const mismoMes = lunes.slice(0, 7) === domingo.slice(0, 7);

    return mismoMes
      ? `${a.getUTCDate()} – ${b.getUTCDate()} de ${b.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' })}`
      : `${a.getUTCDate()} ${a.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })} – ${b.getUTCDate()} ${b.toLocaleDateString('es-ES', { month: 'short', timeZone: 'UTC' })}`;
  }

  return d.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** «Hoy», «mañana» o el día con su nombre. */
function diaCorto(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';

  return new Date(fecha + 'T12:00:00Z').toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/**
 * El día de un turno, corto: «Hoy», «Mañana» o «Domingo 22».
 *
 * Sin el mes mientras sea el de hoy: el turno va en una línea con la hora y el
 * culto, y a 375 px «domingo, 22 de noviembre» la partía en dos. Cuando cae en
 * el mes siguiente —los turnos llegan a tres semanas vista— el mes sí hace
 * falta, o el «Domingo 6» se leería como el de este mes, que ya pasó.
 */
function diaDelTurno(fecha: string, hoy: string): string {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';

  const d = new Date(fecha + 'T12:00:00Z');
  const dia = d.toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'UTC' });
  const mes =
    fecha.slice(0, 7) === hoy.slice(0, 7)
      ? ''
      : ` de ${d.toLocaleDateString('es-ES', { month: 'long', timeZone: 'UTC' })}`;

  return `${dia.charAt(0).toUpperCase()}${dia.slice(1)} ${d.getUTCDate()}${mes}`;
}
