import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';

import {
  exigirUuid,
  requireMinisterioEnLaApp,
} from '@/lib/ministerios/en-la-app/guarda';
import { diaCorto } from '@/lib/ministerios/en-la-app/fechas';
import { rutaApp } from '@/lib/ministerios/en-la-app/rutas';
import { tieneModulo } from '@/lib/ministerios/modulos';
import { obtenerCancion } from '@/lib/repertorio/consultas';
import { sitioDe } from '@/lib/repertorio/enlaces';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Button } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/repertorio/constantes';
import { MarcoEquipo, Rotulo } from '../../../_components/marco';
import { FormularioCancion } from '../_components/formulario';
import { archivarCancion, borrarCancion, editarCancion } from '../actions';

export const metadata: Metadata = { title: 'Canción' };

/**
 * Una canción del repertorio: dónde escucharla, cuándo ha sonado y sus datos.
 *
 * Arriba lo que se viene a mirar —los enlaces y la historia—, y el formulario
 * debajo: se abre esta pantalla más para ensayar que para corregir. Archivar y
 * borrar, plegados al final.
 */
export default async function CancionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cancionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, cancionId } = await params;
  const { error, guardado } = await searchParams;
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'repertorio');
  exigirUuid(cancionId);

  const cancion = await obtenerCancion(ctx, cancionId);
  // La canción tiene que ser de este equipo, no del de al lado.
  if (!cancion || cancion.ministerioId !== id) notFound();

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  // La historia lleva a cada turno, y esa pantalla solo existe con los turnos
  // encendidos: sin ellos, la fecha se queda como texto.
  const conTurnos = tieneModulo(ministerio.modulos, 'turnos');
  const enlaces = [
    { href: cancion.enlaceAudio, texto: 'Escuchar' },
    { href: cancion.enlacePartitura, texto: 'Acordes y letra' },
  ].filter((e): e is { href: string; texto: string } => Boolean(e.href));

  return (
    <MarcoEquipo
      ctx={ctx}
      titulo={cancion.titulo}
      subtitulo={
        [cancion.autor, cancion.tono && `Tono ${cancion.tono}`]
          .filter(Boolean)
          .join(' · ') || ministerio.nombre
      }
      volver={rutaApp(id, 'repertorio')}
      error={error}
      ok={guardado ? CONFIRMACIONES[guardado] : undefined}
    >
      {cancion.archivada && (
        <p className="rounded-xl border border-dashed border-border bg-surface px-4 py-3 text-[14.5px] text-muted-foreground">
          Archivada: no sale al elegir las canciones de un culto.
        </p>
      )}

      {enlaces.length > 0 && (
        <div className="flex flex-col gap-2">
          {enlaces.map((e) => (
            <Button
              key={e.texto}
              variant="outline"
              className="justify-start"
              render={<a href={e.href} target="_blank" rel="noopener noreferrer" />}
            >
              <ExternalLink strokeWidth={1.8} />
              {e.texto}
              <span className="truncate font-normal text-muted-foreground">
                en {sitioDe(e.href)}
              </span>
            </Button>
          ))}
        </div>
      )}

      <Rotulo>Cuándo ha sonado</Rotulo>
      {cancion.historial.length === 0 ? (
        <p className="px-1 text-[14.5px] text-muted-foreground">
          Todavía no ha salido en ninguna lista.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {cancion.historial.map((h) => {
            const texto = (
              <>
                <span className="text-[14.5px] font-semibold">
                  {diaCorto(h.fecha, hoy)}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {h.titulo}
                  {h.tono && ` · en ${h.tono}`}
                  {h.fecha > hoy && ' · planificado'}
                </span>
              </>
            );
            return (
              <li key={h.turnoId}>
                {conTurnos ? (
                  <Link
                    href={rutaApp(id, 'turnos', h.turnoId)}
                    className="flex flex-col px-4 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
                  >
                    {texto}
                  </Link>
                ) : (
                  <div className="flex flex-col px-4 py-2.5">{texto}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <Rotulo>Sus datos</Rotulo>
      <FormularioCancion
        accion={editarCancion.bind(null, id, cancionId)}
        cancion={cancion}
        texto="Guardar los cambios"
      />

      <details className="rounded-xl border border-border bg-surface">
        <summary className="flex min-h-12 cursor-pointer list-none items-center px-4 py-3 text-[15px] font-semibold marker:hidden">
          {cancion.archivada ? 'Volver a tocarla, o borrarla' : 'Si el equipo ya no la toca'}
        </summary>
        <div className="flex flex-col items-start gap-3 border-t border-border p-4">
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
            {cancion.archivada
              ? 'Devuélvela y vuelve a salir al elegir las canciones de un culto.'
              : 'Archívala: deja de salir al elegir las canciones de un culto, y los domingos en que sonó no se pierden.'}
          </p>
          <form action={archivarCancion.bind(null, id, cancionId, !cancion.archivada)}>
            <Button type="submit" variant="outline">
              {cancion.archivada ? (
                <ArchiveRestore strokeWidth={1.8} />
              ) : (
                <Archive strokeWidth={1.8} />
              )}
              {cancion.archivada ? 'Devolverla al repertorio' : 'Archivarla'}
            </Button>
          </form>
          {cancion.historial.length === 0 && (
            <>
              <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                Como no ha salido en ninguna lista, también se puede borrar del
                todo.
              </p>
              <form action={borrarCancion.bind(null, id, cancionId)}>
                <Button type="submit" variant="destructive">
                  <Trash2 strokeWidth={1.8} />
                  Borrarla
                </Button>
              </form>
            </>
          )}
        </div>
      </details>
    </MarcoEquipo>
  );
}
