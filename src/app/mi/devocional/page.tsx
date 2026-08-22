import type { Metadata } from 'next';
import Link from 'next/link';
import { BookOpen, ChevronRight, ExternalLink, Quote } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import {
  devocionalParaLeer,
  devocionalesAnteriores,
} from '@/lib/devocionales/consultas';
import { leerVideo } from '@/lib/devocionales/video';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { VideoDelDevocional } from './_components/video';
import { Compartir } from './_components/compartir';

export const metadata: Metadata = { title: 'Devocional' };

/**
 * El devocional del día, y el archivo de los anteriores.
 *
 * QUÉ TENÍA ANTES: UN RECTÁNGULO Y TRES PÁRRAFOS
 * ----------------------------------------------
 * Foto de 190px con borde, fecha, título, versículo en una caja y el cuerpo.
 * Funcionaba y se leía como un documento: la misma jerarquía tipográfica de
 * arriba abajo, sin nada que dijera dónde empieza lo importante. Y cuando salía
 * el devocional de mañana, el de hoy dejaba de existir.
 *
 * LO QUE CAMBIA
 * -------------
 *   - **La foto es la portada**, a sangre y con el título encima, como en el
 *     muro. Es la misma pieza visual y da coherencia entre las dos pantallas que
 *     más se abren.
 *   - **Se firma.** Un devocional lo escribe alguien de la congregación, con su
 *     nombre y su cara. Sin autor parece una circular; con él, es Marta la que
 *     te está hablando.
 *   - **El versículo destaca de verdad**, con su comilla y el color de marca, en
 *     vez de una caja gris más entre otras cajas grises.
 *   - **Se puede compartir**, que es lo que la gente hace con un devocional que
 *     le ha llegado.
 *   - **Hay archivo.** Los anteriores, al pie, y se abren con `?d=fecha`. Sin
 *     eso, lo que se publicó ayer desaparecía para siempre.
 *
 * Y un detalle que se vio abriendo uno viejo: el «· el último publicado» que
 * avisa de que no estás leyendo el de hoy SOLO se pinta cuando la pantalla ha
 * elegido por su cuenta. Si lo has abierto tú desde el archivo, esa coletilla es
 * falsa —no es el último, es el que pediste— y encima confunde.
 *
 * `?d=` VIAJA EN LA URL Y NO EN UN ESTADO
 * ---------------------------------------
 * Igual que la agenda y que el selector de la suscripción: el servidor ya sabe
 * leerlo, el enlace se comparte tal cual y funciona sin JavaScript.
 */
export default async function DevocionalPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { d: pedida } = await searchParams;
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(pedida ?? '') ? pedida : undefined;

  const d = await devocionalParaLeer(ctx, fecha);
  const video = leerVideo(d?.videoUrl);
  const anteriores = d ? await devocionalesAnteriores(ctx, d.fecha) : [];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={user!}
        titulo="Devocional"
        subtitulo={ctx.iglesia.nombre}
        logoUrl={ctx.iglesia.logoUrl}
        // La flecha solo cuando se está leyendo uno del archivo: desde el de hoy
        // no hay a dónde volver, y una flecha que no lleva a ningún sitio ya
        // costó una tanda en el muro.
        volver={fecha ? '/mi/devocional' : undefined}
      />

      {!d ? (
        <main className="mx-auto flex w-full max-w-[620px] flex-col gap-5 px-4 py-6 sm:px-5">
          <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <BookOpen className="size-5" strokeWidth={1.7} />
            </span>
            <h1 className="t-subtitulo">
              {fecha ? 'Ese devocional no está' : 'Todavía no hay devocional'}
            </h1>
            <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
              {fecha
                ? 'Puede que se haya despublicado. Vuelve al de hoy desde la flecha de arriba.'
                : `Cuando alguien de ${ctx.iglesia.nombre} publique el primero, aparecerá aquí cada día.`}
            </p>
          </div>
        </main>
      ) : (
        <article className="flex flex-col">
          {/*
           * LA PORTADA
           *
           * Mismo patrón que la del muro: foto a sangre, degradado que cierra
           * abajo y el texto con sombra. El degradado rompe la regla 3 del
           * sistema, y es la excepción que ya está anotada en `CLAUDE.md` —sobre
           * una foto, un velo plano de la opacidad suficiente para el peor punto
           * apaga la imagen entera—.
           */}
          {d.imagenUrl ? (
            <section className="relative isolate flex min-h-[220px] flex-col justify-end overflow-hidden sm:min-h-[280px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={d.imagenUrl}
                alt=""
                aria-hidden
                className="absolute inset-0 -z-10 size-full object-cover"
              />

              <div className="flex flex-col gap-1.5 bg-gradient-to-b from-black/10 via-black/45 to-black/85 px-4 pb-5 pt-16 text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)] sm:px-5 sm:pb-6">
                <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/85 first-letter:uppercase">
                  {formatearFechaLarga(d.fecha)}
                  {!fecha && !d.esDeHoy && ' · el último publicado'}
                </span>
                {d.titulo && (
                  <h1 className="text-pretty text-[26px] font-extrabold leading-tight tracking-[-0.02em]">
                    {d.titulo}
                  </h1>
                )}
              </div>
            </section>
          ) : (
            <div className="mx-auto flex w-full max-w-[620px] flex-col gap-1.5 px-4 pt-6 sm:px-5">
              <span className="t-micro first-letter:uppercase">
                {formatearFechaLarga(d.fecha)}
                {!fecha && !d.esDeHoy && ' · el último publicado'}
              </span>
              {d.titulo && <h1 className="t-titulo">{d.titulo}</h1>}
            </div>
          )}

          <div className="mx-auto flex w-full max-w-[620px] flex-col gap-5 px-4 py-5 sm:px-5 sm:py-6">
            {d.autorNombre && (
              <div className="flex items-center gap-2.5">
                <AvatarPersona
                  nombre={d.autorNombre}
                  fotoUrl={d.autorFoto}
                  tamano="sm"
                />
                <span className="text-[13.5px] text-muted-foreground">
                  Lo escribe{' '}
                  <strong className="font-semibold text-foreground">
                    {d.autorNombre}
                  </strong>
                </span>
              </div>
            )}

            {d.versiculo && (
              /*
               * La comilla grande y la barra de color hacen el trabajo que antes
               * hacía una caja gris: decir «esto no es el cuerpo, esto es la
               * cita». Sin ellas, con la misma caja que todo lo demás, el ojo
               * pasaba de largo.
               */
              <blockquote className="relative flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 pl-6">
                <span className="absolute inset-y-4 left-0 w-1 rounded-full bg-support-active" />

                <Quote
                  className="size-[18px] text-badge-success-fg"
                  strokeWidth={2.2}
                  aria-hidden
                />

                <p className="text-pretty text-[17px] font-medium leading-[1.55]">
                  {d.versiculo}
                </p>

                {d.referencia && (
                  <cite className="text-[13.5px] font-semibold not-italic text-badge-success-fg">
                    {d.referencia}
                  </cite>
                )}
              </blockquote>
            )}

            {/*
             * `whitespace-pre-line`: el cuerpo se escribe en un textarea y sus
             * saltos de línea son del autor. Sin esto, un devocional de cinco
             * párrafos sale como un ladrillo.
             */}
            <p className="whitespace-pre-line text-pretty text-[16px] leading-[1.7]">
              {d.cuerpo}
            </p>

            {/*
             * El vídeo se VE aquí dentro, y sin llamar a Google hasta que se
             * pulsa. Si la URL no es de YouTube —Vimeo también está en la lista
             * de dominios que acepta el panel— se queda el enlace de siempre.
             */}
            {video ? (
              <VideoDelDevocional video={video} portada={d.imagenUrl} />
            ) : (
              d.videoUrl && (
                <a
                  href={d.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex w-fit items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 text-[14px] font-semibold no-underline hover:bg-surface-alt hover:no-underline"
                >
                  <ExternalLink className="size-4" strokeWidth={1.8} />
                  Verlo en vídeo
                </a>
              )
            )}

            <Compartir
              titulo={d.titulo ?? 'Devocional'}
              versiculo={d.versiculo}
              referencia={d.referencia}
              iglesia={ctx.iglesia.nombre}
            />

            {anteriores.length > 0 && (
              <section className="flex flex-col gap-2 border-t border-border pt-5">
                <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Anteriores
                </h2>

                <ul className="overflow-hidden rounded-xl border border-border bg-surface">
                  {anteriores.map((a, i) => (
                    <li key={a.fecha}>
                      <Link
                        href={`/mi/devocional?d=${a.fecha}`}
                        className={
                          'flex items-center gap-3 px-3 py-2.5 text-foreground no-underline hover:bg-surface-alt hover:no-underline ' +
                          (i > 0 ? 'border-t border-border' : '')
                        }
                      >
                        {a.imagenUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.imagenUrl}
                            alt=""
                            loading="lazy"
                            className="size-11 flex-none rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <BookOpen className="size-[18px]" strokeWidth={1.7} />
                          </span>
                        )}

                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-[14.5px] font-semibold">
                            {a.titulo ?? 'Devocional'}
                          </span>
                          <span className="truncate text-[12.5px] text-muted-foreground first-letter:uppercase">
                            {formatearFechaLarga(a.fecha)}
                          </span>
                        </span>

                        <ChevronRight
                          className="size-4 flex-none text-muted-foreground"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
