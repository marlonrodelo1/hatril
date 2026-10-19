import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronRight, Plus, Search } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { listarCanciones, type CancionResumen } from '@/lib/repertorio/consultas';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CabeceraPanel } from '../../../_components/cabecera';
import { Contenedor } from '../../../_components/contenedor';
import { PestanasMinisterio } from '../_components/pestanas';
import { CONFIRMACIONES } from './constantes';

export const metadata: Metadata = { title: 'Repertorio' };

/**
 * El repertorio de un equipo: qué canciones sabe tocar y cuándo sonó cada una.
 *
 * «CUÁNDO SE CANTÓ» ES LO QUE SE USA DE VERDAD
 * --------------------------------------------
 * Un cancionero que solo dice títulos lo tiene ya cualquier equipo en un
 * documento. Lo que no tienen es la respuesta a «¿cuánto hace que no cantamos
 * esta?», y por eso cada canción la lleva al lado: es lo que evita repetir la
 * misma tres domingos seguidos y lo que rescata las que llevan meses olvidadas.
 *
 * El buscador va por `?q=` y no por JavaScript: un repertorio de cien canciones
 * no se recorre con el dedo, y un GET funciona en cualquier móvil.
 */
export default async function RepertorioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    q?: string;
    archivadas?: string;
    error?: string;
    guardado?: string;
  }>;
}) {
  const { id } = await params;
  const ctx = await requireIglesia();
  const { q, archivadas, error, guardado } = await searchParams;

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();

  const busqueda = q?.trim().slice(0, 60) || undefined;
  const verArchivadas = archivadas === '1';
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  const lista = await listarCanciones(ctx, id, {
    hoy,
    busqueda,
    archivadas: verArchivadas,
  });

  const base = `/panel/ministerios/${id}/repertorio`;

  return (
    <>
      <CabeceraPanel
        titulo={ministerio.nombre}
        subtitulo="Las canciones del equipo y cuándo sonó cada una"
        volver={{ href: '/panel/ministerios', texto: 'Ministerios' }}
      >
        <Button render={<Link href={`${base}/nueva`} />}>
          <Plus strokeWidth={1.8} />
          Añadir canción
        </Button>
      </CabeceraPanel>

      <Contenedor>
        <PestanasMinisterio ctx={ctx} ministerio={ministerio} activa="repertorio" />

        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <form action={base} className="flex w-full max-w-[420px] items-center gap-2">
            {verArchivadas && <input type="hidden" name="archivadas" value="1" />}
            <Input
              name="q"
              type="search"
              defaultValue={busqueda ?? ''}
              placeholder="Buscar por título o autor"
              aria-label="Buscar en el repertorio"
            />
            <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
              <Search strokeWidth={1.8} />
            </Button>
          </form>

          <Link
            href={verArchivadas ? base : `${base}?archivadas=1`}
            className="px-1 text-[13.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {verArchivadas ? 'Volver al repertorio' : 'Ver las archivadas'}
          </Link>
        </div>

        {lista.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-8">
            {busqueda ? (
              <p className="text-[14.5px] text-muted-foreground">
                Ninguna canción {verArchivadas ? 'archivada ' : ''}coincide con
                «{busqueda}».
              </p>
            ) : verArchivadas ? (
              <p className="text-[14.5px] text-muted-foreground">
                No hay canciones archivadas.
              </p>
            ) : (
              <>
                <h2 className="t-subtitulo">El repertorio está vacío</h2>
                <p className="max-w-[56ch] text-[14.5px] leading-relaxed text-muted-foreground">
                  Apunta las canciones que el equipo sabe tocar, con su tono y
                  dónde escucharlas. Después, en cada turno, eliges las del
                  domingo y el equipo las ve en su agenda.
                </p>
              </>
            )}
          </div>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {lista.map((c) => (
              <li key={c.id} className="border-b border-border last:border-b-0">
                <FilaCancion cancion={c} href={`${base}/${c.id}`} />
              </li>
            ))}
          </ul>
        )}

        {lista.length > 0 && (
          <p className="px-1 text-[13px] text-muted-foreground">
            {lista.length} {lista.length === 1 ? 'canción' : 'canciones'}
            {busqueda ? ` con «${busqueda}»` : ''}.
          </p>
        )}
      </Contenedor>
    </>
  );
}

function FilaCancion({ cancion: c, href }: { cancion: CancionResumen; href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline md:px-5"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold">{c.titulo}</span>
          {c.tono && (
            <span className="flex-none rounded-md bg-badge-neutral-bg px-1.5 py-px text-[12px] font-bold text-badge-neutral-fg">
              {c.tono}
            </span>
          )}
        </span>
        <span className="truncate text-[13px] text-muted-foreground">
          {[c.autor, cuandoSono(c)].filter(Boolean).join(' · ')}
        </span>
      </span>
      <ChevronRight className="size-4 flex-none text-disabled-text" strokeWidth={1.9} aria-hidden />
    </Link>
  );
}

/** «Última vez el domingo, 12 de octubre · 3 veces», o que todavía no ha sonado. */
function cuandoSono(c: CancionResumen): string {
  if (!c.ultimaVez) return 'Sin cantar todavía';
  const veces = c.veces === 1 ? '1 vez' : `${c.veces} veces`;
  return `Última vez el ${formatearFechaLarga(c.ultimaVez)} · ${veces}`;
}
