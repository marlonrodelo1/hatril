import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, Search } from 'lucide-react';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { listarCanciones } from '@/lib/repertorio/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/repertorio/constantes';
import {
  Fila,
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Vacio,
} from '../../_components/marco';
import { Insignia } from '../../_components/insignia';

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
      <Link href={`${base}/nueva`} className={buttonVariants({ className: 'self-start' })}>
        <Plus strokeWidth={1.8} />
        Apuntar una canción
      </Link>

      <form action={base} className="flex items-center gap-2">
        {verArchivadas && <input type="hidden" name="archivadas" value="1" />}
        <Input
          name="q"
          type="search"
          defaultValue={busqueda ?? ''}
          placeholder="Buscar por título o por quién la canta"
          aria-label="Buscar en el repertorio"
          className="h-9 flex-1"
        />
        {/* Barra de filtro: todo a 36, campo y botón, como pide la guía. */}
        <Button type="submit" variant="outline" size="sm">
          <Search strokeWidth={1.8} />
          Buscar
        </Button>
      </form>

      {canciones.length === 0 ? (
        // Un vacío de búsqueda es una línea; el del repertorio entero, una
        // tarjeta que dice qué hacer.
        busqueda || verArchivadas ? (
          <p className="px-1 text-body text-muted-foreground">
            {busqueda
              ? `Ninguna canción coincide con «${busqueda}».`
              : 'No hay canciones archivadas.'}
          </p>
        ) : (
          <Vacio
            titulo="El repertorio está vacío"
            accion={
              <Link href={`${base}/nueva`} className={buttonVariants({ variant: 'outline' })}>
                <Plus strokeWidth={1.8} />
                Apuntar la primera
              </Link>
            }
          >
            Apunta las canciones que toca el equipo, con su tono y dónde
            escucharlas, y podrás montar la lista de cada culto.
          </Vacio>
        )
      ) : (
        <Lista>
          {canciones.map((c) => (
            <Fila key={c.id}>
              <FilaEnlace
                href={`${base}/${c.id}`}
                derecha={
                  c.tono ? (
                    <Insignia tono="neutro">{c.tono}</Insignia>
                  ) : undefined
                }
              >
                <span className="truncate text-body font-semibold">{c.titulo}</span>
                <span className="truncate text-label text-muted-foreground">
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
            </Fila>
          ))}
        </Lista>
      )}

      <Link
        href={verArchivadas ? base : `${base}?archivadas=1`}
        className="self-start px-1 text-label font-semibold text-muted-foreground no-underline hover:text-foreground hover:underline"
      >
        {verArchivadas ? 'Volver a las que se tocan' : 'Ver las archivadas'}
      </Link>
    </MarcoEquipo>
  );
}
