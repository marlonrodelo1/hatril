import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarPlus, MapPin, Users } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listarEventos, type EventoListado } from '@/lib/eventos/consultas';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { ahoraMs } from '@/lib/fecha/ahora';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../_components/cabecera';
import { Contenedor } from '../_components/contenedor';
import { CONFIRMACIONES } from './constantes';

export const metadata: Metadata = { title: 'Eventos' };

export default async function EventosPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const todos = await listarEventos(ctx);
  const ahora = ahoraMs();

  // Los próximos primero y los pasados debajo: la lista de un panel se lee de
  // arriba abajo y lo que importa es lo que todavía no ha ocurrido.
  const proximos = todos.filter(
    (e) => (e.finEn ?? e.inicioEn).getTime() >= ahora,
  );
  const pasados = todos
    .filter((e) => (e.finEn ?? e.inicioEn).getTime() < ahora)
    .reverse();

  const moneda = ctx.iglesia.moneda as Moneda;

  return (
    <>
      <CabeceraPanel
        titulo="Eventos"
        subtitulo="Retiros, congresos y todo lo que tenga fecha y hora"
      >
        <Button render={<Link href="/panel/eventos/nuevo" />}>
          <CalendarPlus strokeWidth={1.8} />
          Crear evento
        </Button>
      </CabeceraPanel>

      {/* `gap-8` y no el gap-6 de serie: aquí lo que se separa son los dos
          bloques de fecha —lo próximo y lo que ya pasó—, y con la misma
          distancia que hay entre las tarjetas de dentro dejan de leerse como
          dos grupos. */}
      <Contenedor className="gap-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {todos.length === 0 ? (
          /* El vacío NO va en rejilla: es un texto que se lee, y partido en una
             columna de un tercio queda una nota estrecha con media pantalla al
             lado. */
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            <h2 className="t-subtitulo">Todavía no hay ningún evento</h2>
            <p className="max-w-[52ch] text-[14.5px] leading-relaxed text-muted-foreground">
              Un evento tiene fecha y hora, y sale en la web de la iglesia con su
              formulario para apuntarse. Los cultos que se repiten cada semana no
              van aquí: esos son los horarios, y se ponen en Ajustes.
            </p>
          </div>
        ) : (
          <>
            <Seccion titulo="Lo próximo" eventos={proximos} moneda={moneda} timezone={ctx.iglesia.timezone}>
              Cuando pase la fecha se irán solos al bloque de abajo.
            </Seccion>
            {pasados.length > 0 && (
              <Seccion titulo="Ya pasaron" eventos={pasados} moneda={moneda} timezone={ctx.iglesia.timezone}>
                Siguen guardados con su lista de inscritos hasta que los borres.
              </Seccion>
            )}
          </>
        )}
      </Contenedor>
    </>
  );
}

/**
 * Una etiqueta de estado.
 *
 * Con los colores de la paleta escritos a mano y no con `<Badge variant>`: el
 * componente de shadcn solo trae `default`, `secondary`, `destructive`,
 * `outline`, `ghost` y `link`, y ninguna es la pareja fondo/texto que el sistema
 * de diseño define para los estados. Es el mismo camino que ya toma
 * `src/lib/miembros/estados.ts`.
 */
function Etiqueta({
  clases,
  children,
}: {
  clases: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex h-[22px] items-center rounded-full px-2.5 text-[12px] font-semibold ${clases}`}
    >
      {children}
    </span>
  );
}

function Seccion({
  titulo,
  eventos,
  moneda,
  timezone,
  children,
}: {
  titulo: string;
  eventos: EventoListado[];
  moneda: Moneda;
  timezone: string;
  children?: React.ReactNode;
}) {
  if (eventos.length === 0) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="t-subtitulo">{titulo}</h2>
        <p className="text-[14px] text-muted-foreground">
          No hay nada. Lo que crees aparecerá aquí.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="t-subtitulo">{titulo}</h2>
        {children && (
          <p className="text-[13px] text-muted-foreground">{children}</p>
        )}
      </div>

      {/*
       * Rejilla y no una tarjeta por fila. Una ficha de evento son dos líneas
       * de texto: apiladas, en un monitor de escritorio dejan tres cuartos de
       * ancho en blanco y obligan a bajar la vista para ver cuatro retiros.
       *
       * Cada grupo —lo próximo y lo pasado— tiene la suya, para que el orden
       * cronológico no se lea en zigzag entre bloques distintos.
       */}
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {eventos.map((e) => (
          <li key={e.id}>
            {/* `h-full` para que las tarjetas de una misma fila queden a la
                altura de la más alta: sin eso, la que no tiene lugar ni precio
                deja un escalón. */}
            <Link
              href={`/panel/eventos/${e.id}`}
              className="flex h-full flex-col gap-2 rounded-xl border border-border bg-surface p-4 no-underline transition-colors hover:bg-background hover:no-underline"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-bold tracking-[-0.015em] text-foreground">
                  {e.titulo}
                </span>
                {e.publicado ? (
                  <Etiqueta clases="bg-badge-success-bg text-badge-success-fg">
                    En la web
                  </Etiqueta>
                ) : (
                  <Etiqueta clases="bg-badge-neutral-bg text-badge-neutral-fg">
                    Sin publicar
                  </Etiqueta>
                )}
                {e.inscripcionesAbiertas && (
                  <Etiqueta clases="bg-badge-accent-bg text-badge-accent-fg">
                    Admite inscripciones
                  </Etiqueta>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13.5px] text-muted-foreground">
                <span className="first-letter:uppercase">
                  {formatearInstante(e.inicioEn, timezone)}
                </span>
                {e.lugar && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-[15px]" strokeWidth={1.7} />
                    {e.lugar}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Users className="size-[15px]" strokeWidth={1.7} />
                  {/* El aforo SÍ se enseña aquí: es el panel. Lo que no sale
                      nunca es en la web pública, donde sería un oráculo. */}
                  {e.cupo
                    ? `${e.ocupadas} de ${e.cupo}`
                    : `${e.ocupadas} apuntados`}
                </span>
                {e.precio && (
                  <span className="font-semibold text-foreground">
                    {formatearDinero(e.precio, moneda)}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
