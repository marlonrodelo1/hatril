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
import { Button, buttonVariants } from '@/components/ui/button';
import { CONFIRMACIONES } from '@/app/panel/ministerios/[id]/repertorio/constantes';
import {
  Fila,
  FilaEnlace,
  Lista,
  MarcoEquipo,
  Seccion,
  ZonaDeBorrar,
} from '../../../_components/marco';
import { FormularioCancion } from '../_components/formulario';
import { archivarCancion, borrarCancion, editarCancion } from '../actions';

export const metadata: Metadata = { title: 'Canción' };

/**
 * Una canción del repertorio: dónde escucharla, cuándo ha sonado y sus datos.
 *
 * Arriba lo que se viene a mirar —los enlaces y la historia—, y el formulario
 * debajo: se abre esta pantalla más para ensayar que para corregir. Archivar
 * y borrar, al final; borrar, en su tarjeta roja.
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
        <p className="rounded-xl border border-border bg-surface px-4 py-3 text-label text-muted-foreground">
          Archivada: no sale al elegir las canciones de un culto.
        </p>
      )}

      {enlaces.length > 0 && (
        <div className="flex flex-col gap-2">
          {/* `<a>` con las clases del botón y no un `Button` con `render`: es
              un enlace de fuera, y Base UI le pondría `type="button"`. */}
          {enlaces.map((e) => (
            <a
              key={e.texto}
              href={e.href}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: 'outline', className: 'justify-start' })}
            >
              <ExternalLink strokeWidth={1.8} />
              {e.texto}
              <span className="truncate font-normal text-muted-foreground">
                en {sitioDe(e.href)}
              </span>
            </a>
          ))}
        </div>
      )}

      <Seccion rotulo="Cuándo ha sonado">
        {cancion.historial.length === 0 ? (
          <p className="px-1 text-body text-muted-foreground">
            Todavía no ha salido en ninguna lista.
          </p>
        ) : (
          <Lista>
            {cancion.historial.map((h) => {
              const texto = (
                <>
                  <span className="text-body font-semibold">
                    {diaCorto(h.fecha, hoy)}
                  </span>
                  <span className="text-label text-muted-foreground">
                    {h.titulo}
                    {h.tono && ` · en ${h.tono}`}
                    {h.fecha > hoy && ' · planificado'}
                  </span>
                </>
              );
              return (
                <Fila key={h.turnoId}>
                  {conTurnos ? (
                    <FilaEnlace href={rutaApp(id, 'turnos', h.turnoId)}>{texto}</FilaEnlace>
                  ) : (
                    <div className="flex flex-col gap-0.5 px-4 py-3 md:px-5">{texto}</div>
                  )}
                </Fila>
              );
            })}
          </Lista>
        )}
      </Seccion>

      <Seccion rotulo="Sus datos">
        <FormularioCancion
          accion={editarCancion.bind(null, id, cancionId)}
          cancion={cancion}
          texto="Guardar los cambios"
        />
      </Seccion>

      <section className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-1">
          <h2 className="t-subtitulo">
            {cancion.archivada ? 'Volver a tocarla' : 'Si el equipo ya no la toca'}
          </h2>
          <p className="max-w-[62ch] text-pretty text-label text-muted-foreground">
            {cancion.archivada
              ? 'Devuélvela y vuelve a salir al elegir las canciones de un culto.'
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
      </section>

      {/* Borrar solo se ofrece si nunca sonó: la base lo impediría de todos
          modos, y un botón que siempre responde «archívala» no es un botón. */}
      {cancion.historial.length === 0 && (
        <ZonaDeBorrar
          titulo="Borrar la canción"
          boton={
            <form action={borrarCancion.bind(null, id, cancionId)}>
              <Button type="submit" variant="destructive">
                <Trash2 strokeWidth={1.8} />
                Borrarla
              </Button>
            </form>
          }
        >
          Como no ha salido en ninguna lista, se puede borrar del todo. No hay
          forma de recuperarla.
        </ZonaDeBorrar>
      )}
    </MarcoEquipo>
  );
}
