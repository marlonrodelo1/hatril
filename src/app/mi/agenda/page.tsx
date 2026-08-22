import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misMinisterios } from '@/lib/ministerios/consultas';
import {
  agendaEntre,
  porDia,
  sumarDias,
  type Ocurrencia,
} from '@/lib/agenda/calendario';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { CalendarioMes, FilaOcurrencia } from './_components/calendario';

export const metadata: Metadata = { title: 'Agenda' };

/**
 * La agenda de un miembro, como calendario.
 *
 * Junta en un solo sitio lo que antes estaba repartido: los cultos y reuniones
 * fijas de la semana, los eventos de la iglesia y los ensayos de los equipos
 * donde sirve. Para un miembro son la misma pregunta —qué tengo yo esta
 * semana— y separarlas le obliga a mirar en dos sitios para contestarla.
 *
 * LA VISTA VIAJA EN LA URL, NO EN EL ESTADO
 * -----------------------------------------
 * `?v=mes|semana|dia` y `?d=YYYY-MM-DD`. Igual que el selector de mensual/anual
 * de la suscripción, y por lo mismo: son dos datos que el servidor ya sabe leer,
 * el enlace se puede compartir tal cual, y avanzar de mes funciona sin una línea
 * de JavaScript. Lo único que vive en el navegador es qué día está abierto en la
 * hoja, que es lo único que no se puede saber sin un dedo.
 *
 * SE PIDE LO QUE SE PINTA, MÁS TRES SEMANAS PARA «PRÓXIMOS»
 * ----------------------------------------------------------
 * La vista necesita su trozo: en mes, las seis semanas completas de la rejilla
 * —con los arrastres del mes vecino, que también se pintan y también tienen que
 * poder marcarse—; en semana, siete días; en día, uno. Y la lista de «Próximos»
 * necesita tres semanas por delante de hoy, mire donde mire la vista.
 *
 * Se traen los dos rangos de una vez. Lo que NO se hace es pedir «los próximos
 * tres meses» por si acaso: eso multiplicaría por doce la expansión de los
 * horarios semanales para enseñar treinta días.
 */
export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string; d?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { v, d } = await searchParams;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const vista: Vista = v === 'dia' || v === 'semana' ? v : 'mes';
  const ancla = /^\d{4}-\d{2}-\d{2}$/.test(d ?? '') ? d! : hoy;

  const ministerios = await misMinisterios(ctx);
  const { desde, hasta } = rangoDe(vista, ancla);

  /*
   * SE CONSULTA UN RANGO Y SE PINTAN DOS COSAS DISTINTAS
   *
   * La vista necesita su trozo —un día, una semana, la rejilla del mes— y la
   * lista de «Próximos» necesita tres semanas por delante de HOY, mire donde
   * mire la vista. Con una sola consulta que cubra los dos, «Próximos» sigue
   * siendo útil en la vista de día.
   *
   * El primer intento reutilizaba el rango de la vista sin más, y en la vista de
   * día quedaba una pantalla que decía «no hay nada ese día» y debajo «no hay
   * nada apuntado por aquí»: dos veces lo mismo, y la segunda además era falsa
   * —había cosas al día siguiente—. Se vio abriendo la pantalla, no leyendo el
   * código.
   */
  const finProximos = sumarDias(hoy, 21);
  const lista = await agendaEntre(
    ctx,
    desde < hoy ? desde : hoy,
    hasta > finProximos ? hasta : finProximos,
    ministerios.map((m) => m.id),
  );

  const proximos = lista.filter((o) => o.fecha >= hoy).slice(0, 6);

  // La vista pinta solo lo suyo, aunque se haya traído de más.
  const porFecha = porDia(
    lista.filter((o) => o.fecha >= desde && o.fecha <= hasta),
  );

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Agenda"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        <Selector vista={vista} ancla={ancla} />

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

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Próximos
          </h2>

          {proximos.length === 0 ? (
            <p className="rounded-xl border border-border bg-surface p-5 text-[14.5px] leading-relaxed text-muted-foreground">
              No hay nada apuntado por aquí. Aparecerán los cultos de{' '}
              {ctx.iglesia.nombre}, sus eventos y los ensayos de los equipos en
              los que sirvas.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {proximos.map((o, i) => (
                <li key={i} className="flex flex-col gap-1">
                  <span className="px-1 text-[12px] font-semibold text-muted-foreground">
                    {diaCorto(o.fecha, hoy)}
                  </span>
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

type Vista = 'dia' | 'semana' | 'mes';

/** El trozo de calendario que hace falta para pintar cada vista. */
function rangoDe(vista: Vista, ancla: string): { desde: string; hasta: string } {
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

function Selector({ vista, ancla }: { vista: Vista; ancla: string }) {
  const opciones: { id: Vista; texto: string }[] = [
    { id: 'dia', texto: 'Día' },
    { id: 'semana', texto: 'Semana' },
    { id: 'mes', texto: 'Mes' },
  ];

  return (
    <div
      className="flex w-full gap-1 rounded-xl border border-border bg-surface p-1"
      role="group"
      aria-label="Cómo ver la agenda"
    >
      {opciones.map((o) => (
        <Link
          key={o.id}
          href={`/mi/agenda?v=${o.id}&d=${ancla}`}
          scroll={false}
          aria-current={vista === o.id ? 'true' : undefined}
          className={
            'flex-1 rounded-lg py-2 text-center text-[13.5px] font-semibold no-underline transition-colors hover:no-underline ' +
            (vista === o.id
              ? 'bg-primary/22 text-badge-accent-fg'
              : 'text-muted-foreground hover:bg-surface-alt hover:text-foreground')
          }
        >
          {o.texto}
        </Link>
      ))}
    </div>
  );
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
        <ChevronLeft className="size-[18px]" strokeWidth={2} />
      </Paso>

      <span className="flex-1 text-center text-[15px] font-bold tracking-[-0.01em] first-letter:uppercase">
        {tituloDelPeriodo(vista, ancla)}
      </span>

      <Paso href={`/mi/agenda?v=${vista}&d=${siguiente}`} etiqueta="Siguiente">
        <ChevronRight className="size-[18px]" strokeWidth={2} />
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
      className="flex size-9 flex-none items-center justify-center rounded-lg border border-border bg-surface text-muted-foreground no-underline hover:bg-surface-alt hover:text-foreground hover:no-underline"
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
      <p className="rounded-xl border border-border bg-surface p-5 text-[14.5px] text-muted-foreground">
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
          <h3 className="px-1 text-[12.5px] font-semibold text-muted-foreground first-letter:uppercase">
            {diaCorto(f, hoy)}
          </h3>
          <ul className="flex flex-col gap-2">
            {(porFecha.get(f) ?? []).map((o, i) => (
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
