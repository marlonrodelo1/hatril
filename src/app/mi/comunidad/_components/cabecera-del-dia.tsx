import Link from 'next/link';
import { BookOpen, Quote } from 'lucide-react';

/**
 * Lo que corona el muro: el versículo del día y, si lo hay, el devocional.
 *
 * EN ESTE ORDEN, Y NO AL REVÉS
 * ----------------------------
 * El versículo primero porque es lo que se lee de un vistazo mientras se
 * desbloquea el móvil. El devocional debajo, porque pide sentarse dos minutos.
 * Y las publicaciones después: son lo que cambia cada hora, así que la gente
 * baja a buscarlas de todos modos.
 *
 * LOS DOS SON INDEPENDIENTES Y LOS DOS PUEDEN FALTAR
 * --------------------------------------------------
 * Puede haber versículo sin devocional —lo normal entre semana—, devocional sin
 * versículo, los dos o ninguno. Si no hay nada, esto no pinta absolutamente
 * nada: un recuadro que dice «hoy no hay devocional» es peor que el silencio,
 * porque convierte en noticia que un líder no haya escrito.
 *
 * EL ÚNICO BLOQUE DE COLOR DE LA PANTALLA
 * ---------------------------------------
 * El versículo va en verde `support` con letra blanca. Es deliberado y es la
 * respuesta a «lo veo todo muy gris»: el muro entero es crema sobre crema, y
 * una sola pieza de color arriba le da un ancla a la vista sin romper ninguna de
 * las tres reglas del sistema —no es un botón naranja, no es un degradado y no
 * es una sombra—.
 *
 * Se usa `support` (#2F5D50) y no `accent`: el naranja está reservado a las
 * acciones, y un bloque naranja del ancho de la pantalla competiría con el único
 * botón de la pantalla. El verde no pide que lo pulses.
 */
export function CabeceraDelDia({
  versiculo,
  devocional,
}: {
  versiculo: {
    versiculo: string;
    referencia: string | null;
    esDeHoy: boolean;
  } | null;
  devocional: {
    titulo: string | null;
    cuerpo: string;
    imagenUrl: string | null;
    esDeHoy: boolean;
  } | null;
}) {
  if (!versiculo && !devocional) return null;

  return (
    <div className="flex flex-col gap-3">
      {versiculo && (
        <section className="flex flex-col gap-2.5 rounded-xl bg-support px-4 py-4 text-white sm:px-5 sm:py-5">
          <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/70">
            <Quote className="size-[14px]" strokeWidth={2.2} aria-hidden />
            {versiculo.esDeHoy ? 'Versículo de hoy' : 'Versículo'}
          </span>

          {/*
           * `text-pretty` y no `text-balance`: son dos o tres líneas de cita, y
           * balance las reparte a lo ancho dejando la última casi vacía.
           */}
          <p className="text-pretty text-[17px] font-medium leading-[1.5] tracking-[-0.01em]">
            {versiculo.versiculo}
          </p>

          {versiculo.referencia && (
            <span className="text-[13.5px] font-semibold text-white/80">
              {versiculo.referencia}
            </span>
          )}
        </section>
      )}

      {devocional && (
        /*
         * Enlace entero y no una tarjeta con un botón dentro: en un móvil, el
         * objetivo que se acierta con el pulgar es la tarjeta, no el enlace de
         * cuatro palabras de la esquina.
         */
        <Link
          href="/mi/devocional"
          className="flex items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-surface no-underline hover:bg-surface-alt hover:no-underline"
        >
          {devocional.imagenUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={devocional.imagenUrl}
              alt=""
              className="size-[92px] flex-none object-cover"
            />
          ) : (
            <span className="flex size-[92px] flex-none items-center justify-center bg-muted text-muted-foreground">
              <BookOpen className="size-6" strokeWidth={1.6} />
            </span>
          )}

          <span className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-3 pr-4">
            <span className="text-[11.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {devocional.esDeHoy ? 'Devocional de hoy' : 'Último devocional'}
            </span>

            <span className="truncate text-[15.5px] font-bold tracking-[-0.015em] text-foreground">
              {devocional.titulo ?? 'Devocional'}
            </span>

            {/*
             * Dos líneas del cuerpo y se corta. El extracto se recorta en el
             * servidor además del `line-clamp` porque un cuerpo de tres mil
             * caracteres viajaría entero al navegador para enseñar cuarenta.
             */}
            <span className="line-clamp-2 text-[13.5px] leading-snug text-muted-foreground">
              {devocional.cuerpo}
            </span>
          </span>
        </Link>
      )}
    </div>
  );
}
