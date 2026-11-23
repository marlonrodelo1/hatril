import Link from 'next/link';
import type { Metadata } from 'next';
import { CalendarDays, ChevronRight } from 'lucide-react';

import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { cronograma, type EntradaCronograma } from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { PestanasMinisterio } from '../../_components/pestanas';
import { SeccionesNinos } from '../_components/secciones';
import { CamposClase, maestrosDe } from '../_components/campos-clase';
import { crearClase } from '../actions';
import { CONFIRMACIONES } from '../constantes';
import { requireNinos } from '../guarda';

export const metadata: Metadata = { title: 'Cronograma de las clases' };

/**
 * El cronograma: qué día, de qué va cada clase, sus puntos y quién la da.
 *
 * INTERNO. Lo ven quien lleva el ministerio —la responsable y los maestros,
 * que son colíderes— y el pastor. Ni las familias ni el resto de la iglesia:
 * lo garantiza la RLS de la `0060`, no esta pantalla.
 *
 * Lo próximo arriba, de cerca a lejos, que es lo que se prepara. Lo pasado,
 * plegado debajo: se consulta poco y con doce semanas apuntadas empujaría lo
 * de este domingo fuera de la pantalla (la queja que ya hubo con la agenda de
 * alabanza).
 */
export default async function CronogramaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { ctx, ministerio } = await requireNinos(id);
  const { error, guardado } = await searchParams;

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const [proximas, pasadas] = await Promise.all([
    cronograma(ctx, id, { desde: hoy }),
    cronograma(ctx, id, { hasta: hoy }),
  ]);
  const maestros = maestrosDe(ministerio.equipo);

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="El cronograma de las clases, solo para los maestros"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      />

      <Contenedor>
        <div className="flex flex-col gap-3">
          <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="ninos" />
          <SeccionesNinos ministerioId={id} activa="cronograma" />
        </div>

        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Apuntar una clase</h2>
            <p className="t-label text-muted-foreground">
              Lo ven los maestros y el pastor. Las familias, no.
            </p>
          </div>
          <form action={crearClase.bind(null, id)} className="flex flex-col gap-4">
            <CamposClase maestros={maestros} hoy={hoy} />
            <BotonEnviar className="self-start">Guardar la clase</BotonEnviar>
          </form>
        </section>

        {proximas.length === 0 ? (
          <EstadoVacio Icono={CalendarDays} titulo="No hay clases apuntadas por delante">
            Apunta la del próximo domingo, con su tema y sus puntos.
          </EstadoVacio>
        ) : (
          <ListaClases titulo="Próximas" ministerioId={id} entradas={proximas} />
        )}

        {pasadas.length > 0 && (
          <details className="flex flex-col gap-2">
            <summary className="cursor-pointer t-micro">Anteriores ({pasadas.length})</summary>
            <div className="mt-2">
              <ListaClases ministerioId={id} entradas={pasadas} />
            </div>
          </details>
        )}
      </Contenedor>
    </>
  );
}

function ListaClases({
  titulo,
  ministerioId,
  entradas,
}: {
  titulo?: string;
  ministerioId: string;
  entradas: EntradaCronograma[];
}) {
  return (
    <section className="flex flex-col gap-2">
      {titulo && <h2 className="t-micro">{titulo}</h2>}
      <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
        {entradas.map((e) => (
          <li key={e.id} className="border-b border-border last:border-b-0">
            <Link
              href={`/panel/ministerios/${ministerioId}/ninos/cronograma/${e.id}`}
              className="flex items-center gap-3 px-4 py-3.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-[13px] font-semibold text-muted-foreground">
                  {formatearFechaLarga(e.fecha)}
                  {e.maestro ? ` · ${e.maestro.nombre}` : ''}
                </span>
                <span className="text-[15px] font-semibold">{e.tema}</span>
                {e.puntos && (
                  <span className="line-clamp-2 whitespace-pre-line text-[13.5px] leading-snug text-muted-foreground">
                    {e.puntos}
                  </span>
                )}
              </span>
              <ChevronRight className="size-4 text-muted-foreground" strokeWidth={1.9} aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
