import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Archive, ArchiveRestore, ExternalLink, Trash2 } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { obtenerCancion } from '@/lib/repertorio/consultas';
import { sitioDe } from '@/lib/repertorio/enlaces';
import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../../../_components/cabecera';
import { Contenedor } from '../../../../_components/contenedor';
import { FormularioCancion } from '../_components/formulario-cancion';
import { archivarCancion, borrarCancion, editarCancion } from '../actions';
import { CONFIRMACIONES } from '../constantes';

export const metadata: Metadata = { title: 'Canción' };

/**
 * Una canción: sus enlaces, cuándo ha sonado y el formulario para cambiarla.
 *
 * Los enlaces arriba y abiertos en otra pestaña, con el sitio escrito: quien
 * entra aquí casi siempre viene a escucharla o a ver los acordes, no a editar.
 */
export default async function CancionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cancionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, cancionId } = await params;
  const ctx = await requireIglesia();
  const { error, guardado } = await searchParams;

  const [ministerio, cancion] = await Promise.all([
    obtenerMinisterio(ctx, id),
    obtenerCancion(ctx, cancionId),
  ]);

  // Que la canción sea de ESTE equipo: el layout comprobó el ministerio de la
  // URL, no la canción. Sin esto, el responsable de jóvenes leería el
  // repertorio de alabanza cambiando un uuid en la barra.
  if (!ministerio || !cancion || cancion.ministerioId !== id) notFound();

  const base = `/panel/ministerios/${id}/repertorio`;
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const enlaces = [
    { href: cancion.enlaceAudio, texto: 'Escuchar' },
    { href: cancion.enlacePartitura, texto: 'Acordes y letra' },
  ].filter((e): e is { href: string; texto: string } => Boolean(e.href));

  return (
    <>
      <CabeceraPanel
        titulo={cancion.titulo}
        subtitulo={
          [cancion.autor, cancion.tono && `Tono ${cancion.tono}`]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        volver={{ href: base, texto: `Repertorio de ${ministerio.nombre}` }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && CONFIRMACIONES[guardado] && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        {cancion.archivada && (
          <p className="rounded-xl border border-dashed border-border bg-surface px-5 py-4 text-[14.5px] text-muted-foreground">
            Archivada: no sale al elegir las canciones de un culto.
          </p>
        )}

        {enlaces.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {enlaces.map((e) => (
              <Button
                key={e.texto}
                variant="outline"
                render={<a href={e.href} target="_blank" rel="noopener noreferrer" />}
              >
                <ExternalLink strokeWidth={1.8} />
                {e.texto}
                <span className="font-normal text-muted-foreground">
                  en {sitioDe(e.href)}
                </span>
              </Button>
            ))}
          </div>
        )}

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">Cuándo ha sonado</h2>
          {cancion.historial.length === 0 ? (
            <p className="text-[14.5px] text-muted-foreground">
              Todavía no ha salido en ninguna lista.
            </p>
          ) : (
            <ul className="flex flex-col">
              {cancion.historial.map((h) => (
                <li key={h.turnoId} className="border-b border-border py-2 last:border-b-0">
                  <Link
                    href={`/panel/ministerios/${id}/turnos/${h.turnoId}`}
                    className="flex items-baseline gap-2 text-[14.5px] text-foreground no-underline hover:no-underline"
                  >
                    <span className="first-letter:uppercase">{formatearFechaLarga(h.fecha)}</span>
                    <span className="text-[13px] text-muted-foreground">
                      {h.titulo}
                      {h.tono && ` · en ${h.tono}`}
                      {h.fecha > hoy && ' · planificado'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <FormularioCancion
          accion={editarCancion.bind(null, id, cancionId)}
          cancion={cancion}
          cancelarHref={base}
        />

        <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">
              {cancion.archivada ? 'Volver a tocarla' : 'Si el equipo ya no la toca'}
            </h2>
            <p className="max-w-[62ch] text-pretty text-[14px] leading-relaxed text-muted-foreground">
              {cancion.archivada
                ? 'Vuelve a salir al elegir las canciones de un culto.'
                : 'Archívala: deja de salir al elegir las canciones de un culto, y los domingos en que sonó no se pierden.'}
            </p>
          </div>
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
              <p className="mt-2 max-w-[62ch] text-[14px] leading-relaxed text-muted-foreground">
                Como no ha salido en ninguna lista, también se puede borrar.
              </p>
              <form action={borrarCancion.bind(null, id, cancionId)}>
                <Button type="submit" variant="destructive">
                  <Trash2 strokeWidth={1.8} />
                  Borrarla
                </Button>
              </form>
            </>
          )}
        </section>
      </Contenedor>
    </>
  );
}
