import Image from 'next/image';
import { Play } from 'lucide-react';
import { clsx } from 'clsx';

import type { devocionalPublico } from '@/lib/devocionales/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { AvatarPersona } from '@/components/avatar-persona';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Insignia } from '@/components/ui/insignia';
import { DevocionalTexto } from './devocional-texto';

type Devocional = NonNullable<Awaited<ReturnType<typeof devocionalPublico>>>;

/**
 * El último devocional publicado, abierto a cualquiera.
 *
 * DE CAJA OSCURA A TARJETA CLARA (rediseño de la zona 3, 17-nov)
 * --------------------------------------------------------------
 * Iba en un panel de cristal oscuro sobre la foto apagada: pesaba mucho y se
 * leía peor que el resto de la web, que es clara. Ahora la foto va arriba, a
 * la vista y sin velo, y el texto debajo sobre el blanco de la tarjeta, con la
 * misma letra que toda la página. En escritorio la foto pasa a la izquierda:
 * arriba, a 1100 px de ancho, sería una franja que obliga a bajar para
 * empezar a leer.
 *
 * Sin foto, la tarjeta empieza por el título y no deja hueco; la fecha, que
 * iba en la insignia de la foto, pasa a la línea del autor.
 */
export function SeccionDevocional({ devocional }: { devocional: Devocional }) {
  const fecha = formatearFechaLarga(devocional.fecha);
  const fechaEscrita = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  const conFoto = Boolean(devocional.imagenUrl);
  const parrafos = devocional.cuerpo
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section
      id="devocional"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="mb-7 flex flex-col gap-2">
        <span className="t-micro text-accent-foreground">
          {devocional.esDeHoy ? 'Devocional de hoy' : 'Último devocional'}
        </span>
        <h2 className="text-[clamp(24px,4vw,32px)] font-extrabold leading-tight tracking-[-0.03em]">
          El devocional
        </h2>
      </div>

      <article
        className={clsx(
          'grid overflow-hidden rounded-xl border border-border bg-surface',
          conFoto
            ? 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]'
            : 'max-w-[760px]',
        )}
      >
        {devocional.imagenUrl && (
          <div className="relative h-[200px] border-b border-border sm:h-[280px] lg:h-auto lg:min-h-[380px] lg:border-r lg:border-b-0">
            <Image
              src={devocional.imagenUrl}
              alt=""
              fill
              sizes="(max-width: 1024px) 100vw, 460px"
              className="object-cover"
            />
            {/* La pastilla va sobre la foto con su propio fondo opaco: se lee
                igual sobre una imagen clara que sobre una oscura, sin velo. */}
            <Insignia className="absolute left-3 top-3">{fechaEscrita}</Insignia>
          </div>
        )}

        <div className="flex min-w-0 flex-col gap-4 p-5 sm:p-6 lg:p-8">
          {devocional.titulo && (
            <h3 className="text-pretty text-[clamp(20px,3vw,26px)] font-extrabold leading-tight tracking-[-0.025em]">
              {devocional.titulo}
            </h3>
          )}

          {(devocional.autorNombre || !conFoto) && (
            <div className="flex items-center gap-2.5">
              {devocional.autorNombre && (
                // Solo las iniciales: `devocionalPublico` no trae la foto de
                // la ficha, y en la web de la calle no hace falta la cara.
                <AvatarPersona nombre={devocional.autorNombre} tamano="sm" />
              )}
              <span className="text-label text-muted-foreground">
                {devocional.autorNombre && (
                  <>
                    Lo escribe{' '}
                    <strong className="font-semibold text-foreground">
                      {devocional.autorNombre}
                    </strong>
                  </>
                )}
                {!conFoto && (
                  <>
                    {devocional.autorNombre && ' · '}
                    {devocional.autorNombre ? fecha : fechaEscrita}
                  </>
                )}
              </span>
            </div>
          )}

          {devocional.versiculo && (
            // El versículo antes que el comentario: es lo que la gente
            // comparte por WhatsApp, y lo que se lee aunque no se lea nada
            // más. La raya naranja es la del diseño aprobado de la zona 3.
            <blockquote className="flex max-w-[62ch] flex-col gap-1.5 border-l-3 border-primary py-0.5 pl-4">
              <p className="text-pretty text-subtitle font-semibold leading-[1.45]">
                {devocional.versiculo}
              </p>
              {devocional.referencia && (
                // En gris y no en naranja: en naranja parecía un enlace, y no
                // lleva a ningún sitio.
                <cite className="text-label font-medium not-italic text-muted-foreground">
                  {devocional.referencia}
                </cite>
              )}
            </blockquote>
          )}

          <DevocionalTexto
            parrafos={parrafos}
            extra={
              /*
               * El vídeo se abre en YouTube, no dentro de la página.
               *
               * Empotrar el reproductor mete varios cientos de kilobytes de
               * JavaScript de terceros y escribe en el navegador de quien pasa
               * por aquí antes de que le dé a play: eso obliga a un aviso de
               * cookies en la web de una iglesia, a cambio de una comodidad que
               * casi nadie usa. Quien quiere verlo, lo ve; quien venía a leer,
               * lee.
               *
               * `noopener noreferrer` porque abre en otra pestaña: sin
               * `noopener`, la página de destino puede manipular la nuestra.
               */
              devocional.videoUrl ? (
                <BotonEnlace
                  nativo
                  href={devocional.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="ghost"
                  size="sm"
                >
                  <Play strokeWidth={1.8} />
                  Verlo en vídeo
                </BotonEnlace>
              ) : undefined
            }
          />
        </div>
      </article>
    </section>
  );
}
