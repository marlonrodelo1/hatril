import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Search } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarCanciones } from '@/lib/repertorio/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/repertorio/constantes';
import { FilaEnlace, Lista, MarcoEquipo, Vacio } from '../../_components/marco';
import { CAMPO } from '../../_components/estilos';

export const metadata: Metadata = { title: 'Repertorio' };

/**
 * Las canciones del equipo, en la app.
 *
 * La lista del domingo NO se monta aquí sino en el turno, que es de donde
 * cuelga. Esto es el fichero de canciones: buscar una, apuntar la nueva que
 * se va a estrenar, corregir un tono. La búsqueda va en la URL (`?q=`), como en
 * el panel, y funciona sin JavaScript.
 */
export default async function RepertorioEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    guardado?: string;
    q?: string;
    archivadas?: string;
  }>;
}) {
  const { id } = await params;
  const { error, guardado, q, archivadas } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'repertorio');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const busqueda = q?.trim().slice(0, 80) || undefined;
  const verArchivadas = archivadas === '1';
  const canciones = await listarCanciones(ctx, id, {
    hoy,
    busqueda,
    archivadas: verArchivadas,
  });
  const base = rutaApp(id, 'repertorio');

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo="Repertorio"
      subtitulo={ministerio.nombre}
      volver={rutaApp(id)}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      <Button className="self-start" render={<Link href={`${base}/nueva`} />}>
        <Plus strokeWidth={1.8} />
        Apuntar una canción
      </Button>

      <form action={base} className="flex items-center gap-2">
        {verArchivadas && <input type="hidden" name="archivadas" value="1" />}
        <Input
          name="q"
          type="search"
          defaultValue={busqueda ?? ''}
          placeholder="Buscar por título o por quién la canta"
          aria-label="Buscar en el repertorio"
          className={`flex-1 ${CAMPO}`}
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          <Search strokeWidth={1.8} />
        </Button>
      </form>

      {canciones.length === 0 ? (
        <Vacio>
          <p>
            {busqueda
              ? `Ninguna canción coincide con «${busqueda}».`
              : verArchivadas
                ? 'No hay canciones archivadas.'
                : 'El repertorio está vacío. Apunta las canciones que toca el equipo y podrás montar la lista de cada culto.'}
          </p>
        </Vacio>
      ) : (
        <Lista>
          {canciones.map((c) => (
            <li key={c.id}>
              <FilaEnlace
                href={`${base}/${c.id}`}
                derecha={
                  c.tono ? (
                    <span className="flex-none rounded-md bg-badge-neutral-bg px-2 py-0.5 text-[13px] font-bold text-foreground">
                      {c.tono}
                    </span>
                  ) : undefined
                }
              >
                <span className="truncate text-[15px] font-semibold">{c.titulo}</span>
                <span className="truncate text-[13px] text-muted-foreground">
                  {[
                    c.autor,
                    c.veces === 0
                      ? 'Sin estrenar'
                      : `${c.veces} ${c.veces === 1 ? 'vez' : 'veces'} · la última, ${diaCorto(c.ultimaVez!, hoy).toLocaleLowerCase('es')}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </FilaEnlace>
            </li>
          ))}
        </Lista>
      )}

      <Link
        href={verArchivadas ? base : `${base}?archivadas=1`}
        className="self-start px-1 text-[13.5px] font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {verArchivadas ? 'Volver a las que se tocan' : 'Ver las archivadas'}
      </Link>
    </MarcoEquipo>
  );
}
