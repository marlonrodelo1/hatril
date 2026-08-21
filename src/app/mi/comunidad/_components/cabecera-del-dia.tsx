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
 * EL GLASEADO SOBRE LA FOTO, Y LO QUE COSTÓ QUE NO FUERA ILEGIBLE
 * ---------------------------------------------------------------
 * El versículo lleva de fondo la foto del devocional y encima un cristal verde.
 * No es una capa de color a secas: es `backdrop-blur` de verdad, así que lo que
 * se difumina es la foto que hay detrás.
 *
 * Tres cosas que no son evidentes y que hacen que esto funcione:
 *
 *   1. **La opacidad no baja de 0.82.** Una foto de un culto tiene focos
 *      blancos y zonas negras; con el cristal a 0.6, media frase del versículo
 *      cae sobre un foco y desaparece. El blur ayuda pero no iguala la
 *      luminosidad — eso lo hace el color de encima.
 *   2. **Con guarda `supports-[backdrop-filter]`.** Donde no hay blur, el
 *      cristal sube a opaco. Un translúcido sin difuminar sobre una foto con
 *      contraste es exactamente el caso ilegible.
 *   3. **Sin degradado.** La regla 3 del sistema de diseño lo prohíbe, y aquí
 *      además no hace falta: el color es uniforme, así que el contraste es el
 *      mismo en la primera línea y en la última. Un degradado habría dejado la
 *      referencia de abajo en tierra de nadie.
 *
 * Sin foto, el bloque se queda en verde sólido. Es el mismo componente.
 *
 * POR QUÉ VERDE Y NO NARANJA
 * --------------------------
 * `accent` está reservado a las acciones, y un bloque naranja del ancho de la
 * pantalla competiría con el único botón que hay. El verde no pide que lo
 * pulses. Y es el único bloque de color del muro a propósito: es la respuesta a
 * «lo veo todo muy gris», y deja de serlo en cuanto haya tres.
 */
export function CabeceraDelDia({
  versiculo,
  devocional,
}: {
  versiculo: {
    versiculo: string;
    referencia: string | null;
    imagenUrl: string | null;
    fecha: string;
    esDeHoy: boolean;
  } | null;
  devocional: {
    titulo: string | null;
    cuerpo: string;
    imagenUrl: string | null;
    fecha: string;
    esDeHoy: boolean;
  } | null;
}) {
  if (!versiculo && !devocional) return null;

  /*
   * Cuando los dos salen de la misma fila —que es lo normal— la foto ya está
   * puesta arriba, difuminada. Repetirla nítida en la miniatura de abajo, dos
   * centímetros más allá, se lee como un error de maquetación. En ese caso el
   * devocional se queda con su icono.
   */
  const mismaFila =
    Boolean(versiculo && devocional) && versiculo!.fecha === devocional!.fecha;

  const fotoDelDevocional = mismaFila ? null : (devocional?.imagenUrl ?? null);

  return (
    <div className="flex flex-col gap-3">
      {versiculo && (
        <section className="relative isolate overflow-hidden rounded-xl">
          {versiculo.imagenUrl && (
            /*
             * `<img>` y no `next/image`: es la misma foto que ya sirve el bucket
             * público con URL permanente, y aquí va difuminada detrás de un
             * cristal —optimizarla para eso es trabajo que no se ve—.
             *
             * `aria-hidden` porque es decoración: el contenido es el versículo.
             */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={versiculo.imagenUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 -z-10 size-full object-cover"
            />
          )}

          <div
            className={
              'flex flex-col gap-2.5 px-4 py-5 text-white sm:px-5 sm:py-6 ' +
              // Sin foto no hay nada que difuminar: verde sólido y ya está.
              (versiculo.imagenUrl
                ? 'bg-support/95 supports-backdrop-filter:bg-support/82 supports-backdrop-filter:backdrop-blur-md'
                : 'bg-support')
            }
          >
            {/*
             * Blanco PURO en la etiqueta, no `text-white/75`.
             *
             * Con el cristal a 0.82 sobre una foto muy clara, el fondo sube
             * hasta un verde grisáceo y el blanco al 75% se queda en 3.5:1 —por
             * debajo del 4.5:1 que pide la norma para texto de este tamaño—. En
             * blanco puro son 4.8:1 incluso en ese peor caso, que es una foto
             * blanca entera detrás.
             */}
            <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
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
              <span className="text-[13.5px] font-semibold text-white/90">
                {versiculo.referencia}
              </span>
            )}
          </div>
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
          {fotoDelDevocional ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoDelDevocional}
              alt=""
              className="size-[92px] flex-none object-cover"
            />
          ) : (
            <span className="flex w-[68px] flex-none items-center justify-center bg-muted text-muted-foreground">
              <BookOpen className="size-5" strokeWidth={1.6} />
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
