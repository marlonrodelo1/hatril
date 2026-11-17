import type { Metadata } from 'next';
import { BookOpen, ExternalLink, Quote } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import {
  devocionalParaLeer,
  devocionalesAnteriores,
} from '@/lib/devocionales/consultas';
import { leerVideo } from '@/lib/devocionales/video';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Fila, Lista } from '@/components/ui/fila';
import { createClient } from '@/lib/supabase/server';
import { CabeceraMiembro } from '../_components/cabecera-miembro';
import { TamanoLetra, TextoAMedida } from '../_components/tamano-letra';
import { VideoDelDevocional } from './_components/video';
import { Compartir } from './_components/compartir';
import { BarraLectura } from './_components/barra-lectura';
import { LoHeLeido } from './_components/lo-he-leido';

export const metadata: Metadata = { title: 'Devocional' };

/** El final de la lectura: hasta ahí se llena la barra de arriba. */
const FIN_DE_LA_LECTURA = 'fin-del-devocional';

/** «martes, 17 de noviembre» → «Martes, 17 de noviembre». */
function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

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
 *   - **El versículo destaca de verdad**, en su tarjeta y un poco más grande
 *     que el cuerpo, en vez de una caja gris más entre otras cajas grises.
 *   - **Se puede compartir**, que es lo que la gente hace con un devocional que
 *     le ha llegado.
 *   - **Hay archivo.** Los anteriores, al pie, y se abren con `?d=fecha`. Sin
 *     eso, lo que se publicó ayer desaparecía para siempre.
 *
 * PARA LEER CON CALMA (zona 2 del rediseño, 17-nov)
 * -------------------------------------------------
 * Un texto largo en el móvil, muchas veces leído por gente mayor: lo que más
 * pesa es la letra.
 *   - **A− y A+ en la cabecera** (`TamanoLetra`), recordado en el móvil y
 *     compartido con la Biblia.
 *   - **Una línea naranja arriba** que se llena mientras se lee
 *     (`BarraLectura`), para saber cuánto queda.
 *   - **«Lo he leído» al final**, que solo ve la propia persona
 *     (`LoHeLeido`, y allí el porqué).
 *   - **El versículo pierde la raya naranja** de adorno: el naranja es para
 *     acciones, y una barra de color junto a un texto se lee como «esto se
 *     pulsa» o como «esto está seleccionado».
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
        // Con flecha, sin logo, como el resto de pantallas de detalle de `/mi`
        // (`equipo/_components/marco.tsx`). Aquí además hace falta el sitio: con
        // la flecha, el logo y A−/A+, «Devocional» se quedaba en «Devoc…».
        logoUrl={fecha ? undefined : ctx.iglesia.logoUrl}
        // La flecha solo cuando se está leyendo uno del archivo: desde el de hoy
        // no hay a dónde volver, y una flecha que no lleva a ningún sitio ya
        // costó una tanda en el muro.
        volver={fecha ? '/mi/devocional' : undefined}
      >
        {/* Sin devocional no hay nada que leer, ni letra que cambiar. */}
        {d && <TamanoLetra para="devocional" />}
      </CabeceraMiembro>

      {d && <BarraLectura hasta={FIN_DE_LA_LECTURA} />}

      {!d ? (
        <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
          <EstadoVacio
            Icono={BookOpen}
            titulo={fecha ? 'Ese devocional no está' : 'Todavía no hay devocional'}
            accion={
              fecha && (
                <BotonEnlace variant="outline" href="/mi/devocional">
                  Ir al de hoy
                </BotonEnlace>
              )
            }
          >
            {fecha
              ? 'Puede que se haya despublicado. El de hoy sigue en su sitio.'
              : `Cuando alguien de ${ctx.iglesia.nombre} publique el primero, aparecerá aquí cada día.`}
          </EstadoVacio>
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
                <span className="text-label text-muted-foreground">
                  Lo escribe{' '}
                  <strong className="font-semibold text-foreground">
                    {d.autorNombre}
                  </strong>
                </span>
              </div>
            )}

            {/*
             * Lo que se lee, a la letra que haya elegido cada uno. El autor de
             * arriba y los botones de abajo se quedan a su tamaño: son interfaz,
             * no lectura, y si crecieran con el texto descolocarían la pantalla.
             */}
            <TextoAMedida para="devocional" className="flex flex-col gap-5">
              {d.versiculo && (
                /*
                 * Sin la raya naranja de antes. Lo que dice «esto es la cita y
                 * no el cuerpo» es la tarjeta con su borde, la comilla en gris
                 * y el versículo 2 px más grande que el texto (`1em + 2px`, ver
                 * `TextoAMedida`). La referencia, en gris: en naranja parecía un
                 * enlace, y no lleva a ningún sitio.
                 */
                <blockquote className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5">
                  <Quote
                    className="size-4 text-muted-foreground"
                    strokeWidth={1.8}
                    aria-hidden
                  />

                  <p className="text-pretty text-[length:calc(1em_+_2px)] font-medium leading-[1.5]">
                    {d.versiculo}
                  </p>

                  {d.referencia && (
                    <cite className="text-label font-semibold not-italic text-muted-foreground">
                      {d.referencia}
                    </cite>
                  )}
                </blockquote>
              )}

              {/*
               * `whitespace-pre-line`: el cuerpo se escribe en un textarea y sus
               * saltos de línea son del autor. Sin esto, un devocional de cinco
               * párrafos sale como un ladrillo. Sin tamaño propio: lo hereda de
               * `TextoAMedida`.
               */}
              <p className="whitespace-pre-line text-pretty leading-[1.7]">
                {d.cuerpo}
              </p>
            </TextoAMedida>

            {/*
             * El vídeo se VE aquí dentro, y sin llamar a Google hasta que se
             * pulsa. Si la URL no es de YouTube —Vimeo también está en la lista
             * de dominios que acepta el panel— se queda el enlace de siempre.
             */}
            {video ? (
              <VideoDelDevocional video={video} portada={d.imagenUrl} />
            ) : (
              d.videoUrl && (
                <BotonEnlace
                  variant="outline"
                  href={d.videoUrl}
                  nuevaPestana
                  className="w-fit"
                >
                  <ExternalLink strokeWidth={1.8} />
                  Verlo en vídeo
                </BotonEnlace>
              )
            )}

            <div id={FIN_DE_LA_LECTURA}>
              {/* La fecha basta para distinguirlo dentro de la iglesia: hay uno
                  por día como mucho, y no hay otro identificador en pantalla. */}
              <LoHeLeido clave={`${ctx.iglesia.id}:${d.fecha}`} />
            </div>

            <Compartir
              titulo={d.titulo ?? 'Devocional'}
              versiculo={d.versiculo}
              referencia={d.referencia}
              iglesia={ctx.iglesia.nombre}
            />

            {anteriores.length > 0 && (
              <section className="flex flex-col gap-2.5 border-t border-border pt-5">
                <h2 className="t-micro px-1">Anteriores</h2>

                <Lista>
                  {anteriores.map((a) => (
                    <Fila
                      key={a.fecha}
                      href={`/mi/devocional?d=${a.fecha}`}
                      inicio={
                        a.imagenUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={a.imagenUrl}
                            alt=""
                            loading="lazy"
                            className="size-11 flex-none rounded-lg object-cover"
                          />
                        ) : (
                          <span className="flex size-11 flex-none items-center justify-center rounded-lg bg-muted text-muted-foreground">
                            <BookOpen className="size-[18px]" strokeWidth={1.8} />
                          </span>
                        )
                      }
                      titulo={a.titulo ?? 'Devocional'}
                      detalle={conMayuscula(formatearFechaLarga(a.fecha))}
                    />
                  ))}
                </Lista>
              </section>
            )}
          </div>
        </article>
      )}
    </div>
  );
}
