import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Trash2 } from 'lucide-react';
import { z } from 'zod';

import { formatearFechaLarga, hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { fechaDeBorrado } from '@/lib/ninos/limites';
import {
  archivosDelDrive,
  ninosDelMinisterio,
  publicacionDelTablon,
} from '@/lib/ninos/consultas';
import { Aviso } from '@/components/aviso';
import { BotonEnviar } from '@/components/ui/boton-enviar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Insignia } from '@/components/ui/insignia';
import { Label } from '@/components/ui/label';
import { CabeceraPanel } from '../../../../../_components/cabecera';
import { Contenedor } from '../../../../../_components/contenedor';
import { CuadroArchivo, firmarArchivos } from '../../_components/archivo';
import {
  adjuntarArchivos,
  borrarPublicacion,
  editarPublicacion,
  publicar,
  quitarDePublicacion,
  retirarPublicacion,
} from '../../actions';
import { CONFIRMACIONES } from '../../constantes';
import { requireNinos } from '../../guarda';

export const metadata: Metadata = { title: 'Publicación del tablón' };

const CLASE_TEXTAREA =
  'min-h-[96px] w-full rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[16px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px]';

/**
 * Una publicación del tablón: el texto, sus fotos y vídeos, y publicarla.
 *
 * LA LISTA DE QUIÉN PUEDE SALIR, ARRIBA DE TODO
 * --------------------------------------------
 * Hatril no sabe quién sale en cada foto, y no debe saberlo: etiquetar niños o
 * reconocer caras sería tratar datos biométricos de menores. Lo que sí sabe es
 * qué niños tienen el permiso de todos sus padres, y eso es lo que mira quien
 * publica antes de pulsar. Cualquier niño que no esté en la lista —incluidos
 * los que no tienen a su familia en la app— no sale.
 *
 * El naranja es «Publicar» mientras es un borrador. Publicada, ya no hay
 * acción principal: retirar va en contorno.
 */
export default async function PublicacionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; publicacionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, publicacionId } = await params;
  const { ctx, ministerio } = await requireNinos(id);
  const { error, guardado } = await searchParams;

  if (!z.string().uuid().safeParse(publicacionId).success) notFound();
  const [publicacion, sueltos, ninos] = await Promise.all([
    publicacionDelTablon(ctx, id, publicacionId),
    archivosDelDrive(ctx, id),
    ninosDelMinisterio(ctx, id),
  ]);
  if (!publicacion) notFound();

  const disponibles = sueltos.filter((a) => a.publicacionId === null).slice(0, 60);
  const urls = await firmarArchivos([...publicacion.archivos, ...disponibles]);

  const pueden = ninos.filter((n) => n.puedeSalir);
  const publicada = publicacion.publicadaAt !== null;
  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);

  return (
    <>
      <CabeceraPanel
        titulo={formatearFechaLarga(publicacion.fecha)}
        subtitulo={publicada ? 'Publicada: la ven las familias aceptadas' : 'Borrador: todavía no la ve nadie'}
        volver={{ href: `/panel/ministerios/${id}/ninos`, texto: `${ministerio.nombre} · Tablón` }}
      />

      <Contenedor ancho="formulario">
        {error && <Aviso>{error}</Aviso>}
        {guardado && Object.hasOwn(CONFIRMACIONES, guardado) && (
          <Aviso tipo="ok">{CONFIRMACIONES[guardado]}</Aviso>
        )}

        <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">Pueden salir en fotos y vídeos</h2>
          {pueden.length > 0 ? (
            <p className="text-pretty text-[14.5px] leading-relaxed">
              {pueden.map((n) => n.nombre).join(', ')}.
            </p>
          ) : (
            <p className="text-pretty text-[14.5px] leading-relaxed">Ningún niño, todavía.</p>
          )}
          <p className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
            Ningún otro niño puede salir: tampoco los que no tienen a su familia en
            la app. Si en una foto sale alguien que no está en la lista, no la
            añadas.
          </p>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <h2 className="t-subtitulo">El texto</h2>
          <form action={editarPublicacion.bind(null, id, publicacionId)} className="flex flex-col gap-4">
            {!publicada && (
              <div className="flex flex-col gap-1.5 sm:max-w-[220px]">
                <Label htmlFor="fecha">Día de la actividad</Label>
                <Input id="fecha" name="fecha" type="date" required max={hoy} defaultValue={publicacion.fecha} />
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="texto">Qué hicisteis</Label>
              <textarea
                id="texto"
                name="texto"
                required
                maxLength={1000}
                rows={4}
                defaultValue={publicacion.texto}
                className={CLASE_TEXTAREA}
              />
            </div>
            <Button type="submit" variant="outline" className="self-start">
              Guardar el texto
            </Button>
          </form>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
          <div className="flex flex-col gap-0.5">
            <h2 className="t-subtitulo">Fotos y vídeos de esta publicación</h2>
            <p className="t-label text-muted-foreground">
              {publicacion.archivos.length === 0
                ? 'Ninguno todavía. Se puede publicar solo con el texto.'
                : `${publicacion.archivos.length} en la publicación.`}
            </p>
          </div>
          {publicacion.archivos.length > 0 && (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {publicacion.archivos.map((a) => (
                <li key={a.id} className="flex flex-col gap-1.5">
                  <CuadroArchivo archivo={a} urls={urls(a)} />
                  <form action={quitarDePublicacion.bind(null, id, publicacionId, a.id)}>
                    <Button type="submit" variant="ghost" size="sm" className="w-full text-muted-foreground">
                      Quitar de aquí
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          {disponibles.length > 0 ? (
            <details className="flex flex-col gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
              <summary className="cursor-pointer text-[14.5px] font-semibold">
                Añadir del drive ({disponibles.length} sin publicar)
              </summary>
              <form action={adjuntarArchivos.bind(null, id, publicacionId)} className="mt-3 flex flex-col gap-3">
                <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {disponibles.map((a) => (
                    <li key={a.id}>
                      <label className="flex cursor-pointer flex-col gap-1.5">
                        <CuadroArchivo archivo={a} urls={urls(a)} />
                        <span className="flex items-center gap-2 text-[13px]">
                          <input type="checkbox" name="archivos" value={a.id} />
                          {formatearFechaLarga(a.fecha)}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
                <Button type="submit" variant="outline" className="self-start">
                  Añadir los marcados
                </Button>
              </form>
            </details>
          ) : (
            <p className="text-pretty text-[13.5px] leading-snug text-muted-foreground">
              No hay nada sin publicar en el drive. Sube las fotos desde «Drive».
            </p>
          )}
        </section>

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
          {publicada ? (
            <>
              <div className="flex items-center gap-2">
                <Insignia tono="exito" punto>
                  Publicada
                </Insignia>
                <span className="text-[13.5px] text-muted-foreground">
                  {publicacion.caducaEl
                    ? `Se borra con sus fotos el ${fechaDeBorrado(publicacion.caducaEl)}.`
                    : 'Se borra con sus fotos al cumplir el año.'}
                </span>
              </div>
              <form action={retirarPublicacion.bind(null, id, publicacionId)}>
                <Button type="submit" variant="outline">
                  Retirar del tablón
                </Button>
              </form>
            </>
          ) : (
            <form action={publicar.bind(null, id, publicacionId)} className="flex flex-col gap-3">
              {publicacion.archivos.length > 0 && (
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" name="revisado" className="mt-1" />
                  <span className="text-pretty text-[14px] leading-snug">
                    He mirado las fotos y los vídeos: solo salen niños de la lista de
                    arriba.
                  </span>
                </label>
              )}
              <BotonEnviar pendiente="Publicando…" className="self-start">
                Publicar para las familias
              </BotonEnviar>
            </form>
          )}
        </section>

        <form action={borrarPublicacion.bind(null, id, publicacionId)} className="self-start">
          <Button type="submit" variant="destructive" size="sm">
            <Trash2 className="size-4" strokeWidth={1.9} aria-hidden />
            Borrar la publicación
          </Button>
        </form>
      </Contenedor>
    </>
  );
}
