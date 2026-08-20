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
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-5 py-4 md:px-8">
        <div>
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
            Eventos
          </h1>
          <p className="text-[13px] text-muted-foreground">
            Retiros, congresos y todo lo que tenga fecha y hora
          </p>
        </div>
        <Button render={<Link href="/panel/eventos/nuevo" />}>
          <CalendarPlus strokeWidth={1.8} />
          Crear evento
        </Button>
      </header>

      <div className="flex w-full max-w-[1000px] flex-col gap-8 px-5 pb-16 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {todos.length === 0 ? (
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
      </div>
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

      <ul className="flex flex-col gap-2">
        {eventos.map((e) => (
          <li key={e.id}>
            <Link
              href={`/panel/eventos/${e.id}`}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 no-underline transition-colors hover:bg-background hover:no-underline"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[16px] font-bold tracking-[-0.015em] text-foreground">
                  {e.titulo}
                </span>
                {e.publicado ? (
                  <Etiqueta clases="bg-[#E4EDE9] text-[#2F5D50]">
                    En la web
                  </Etiqueta>
                ) : (
                  <Etiqueta clases="bg-[#EDE8DF] text-[#6B645C]">
                    Sin publicar
                  </Etiqueta>
                )}
                {e.inscripcionesAbiertas && (
                  <Etiqueta clases="bg-[#F7E4DA] text-[#BD4715]">
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
