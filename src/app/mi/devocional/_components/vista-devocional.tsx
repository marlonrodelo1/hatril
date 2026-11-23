import type { ReactNode } from 'react';
import { BookOpen, ExternalLink, Quote } from 'lucide-react';

import type { devocionalParaLeer, devocionalesAnteriores } from '@/lib/devocionales/consultas';
import type { leerVideo } from '@/lib/devocionales/video';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { EstadoVacio } from '@/components/ui/estado-vacio';
import { Fila, Lista } from '@/components/ui/fila';
import { TextoAMedida } from '../../_components/tamano-letra';
import { VideoDelDevocional } from './video';
import { Compartir } from './compartir';
import { BarraLectura } from './barra-lectura';
import { LoHeLeido } from './lo-he-leido';

/** El final de la lectura: hasta ahí se llena la barra de arriba. */
const FIN_DE_LA_LECTURA = 'fin-del-devocional';

/** «martes, 17 de noviembre» → «Martes, 17 de noviembre». */
function conMayuscula(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/**
 * Lo que pinta el devocional, sin consultar nada.
 *
 * Salió de `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`), cada una con sus datos. El porqué de cada pieza
 * está en la cabecera de esa página. La cabecera de la pantalla llega hecha
 * (`cabecera`): en la web la pone `CabeceraMiembro`, que consulta, y en la
 * app la suya.
 */
export type DevocionalParaLeer = Awaited<ReturnType<typeof devocionalParaLeer>>;
export type DevocionalAnterior = Awaited<ReturnType<typeof devocionalesAnteriores>>[number];

export function VistaDevocional({
  cabecera,
  iglesia,
  fecha,
  d,
  video,
  anteriores,
}: {
  cabecera: ReactNode;
  iglesia: { id: string; nombre: string };
  /** La fecha pedida (`?d=`), o nada para el de hoy. */
  fecha?: string;
  d: DevocionalParaLeer;
  video: ReturnType<typeof leerVideo>;
  anteriores: DevocionalAnterior[];
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

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
              : `Cuando alguien de ${iglesia.nombre} publique el primero, aparecerá aquí cada día.`}
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
              <LoHeLeido clave={`${iglesia.id}:${d.fecha}`} />
            </div>

            <Compartir
              titulo={d.titulo ?? 'Devocional'}
              versiculo={d.versiculo}
              referencia={d.referencia}
              iglesia={iglesia.nombre}
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
