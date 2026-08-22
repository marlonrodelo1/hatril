import Link from 'next/link';
import { BookOpen, ChevronRight, Quote } from 'lucide-react';

/**
 * La portada del muro: una sola pieza con foto de fondo que se come el
 * versículo del día, el devocional y el compositor.
 *
 * ERAN TRES BLOQUES SUELTOS
 * -------------------------
 * Versículo verde, tarjeta del devocional y disparador de publicar, uno debajo
 * de otro con su hueco entre medias. Funcionaba y se leía como tres cosas sin
 * relación puestas en fila. Ahora es una portada: lo de hoy y lo que se quiera
 * decir hoy, dentro del mismo marco.
 *
 * EL DEGRADADO ROMPE LA REGLA 3 DEL SISTEMA, A PROPÓSITO
 * ------------------------------------------------------
 * «Sin degradados ni sombras: la profundidad se hace con bordes de 1px». Lo
 * pidió Marlon y aquí, además, no hay alternativa: sobre una foto cualquiera el
 * texto necesita que el fondo se oscurezca justo donde él está, y un velo plano
 * de la opacidad suficiente para el peor punto de la imagen apaga la foto
 * entera. El degradado deja ver la foto arriba y garantiza el contraste abajo.
 *
 * La regla sigue valiendo para el resto de la aplicación: es la única superficie
 * con degradado, igual que el versículo era el único bloque de color.
 *
 * LAS TRES CAPAS, Y POR QUÉ SON TRES
 * ----------------------------------
 *   1. La **foto**, a tamaño completo.
 *   2. El **glaseado**, que difumina la foto entera. Sin él, una foto con mucho
 *      detalle —un culto lleno de gente— compite con el texto letra por letra.
 *   3. El **degradado**, de verde translúcido arriba a casi negro abajo. Arriba
 *      deja respirar la imagen; abajo, donde está el compositor y las líneas
 *      pequeñas, cierra hasta 0.88 para que nada dependa de qué se fotografió.
 *
 * Todo con la guarda `supports-backdrop-filter`: donde no hay desenfoque, el
 * velo sube a opaco. Un translúcido sin difuminar sobre una foto con contraste
 * es exactamente el caso ilegible.
 *
 * SIN FOTO NO SE INVENTA NADA
 * ---------------------------
 * Se queda el verde de marca liso, que es lo que había antes. Una portada con
 * un hueco gris donde debería ir la imagen se lee como un fallo de carga.
 */
export function CabeceraDelDia({
  versiculo,
  devocional,
  children,
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
  /** El compositor. Va dentro de la portada, no debajo. */
  children?: React.ReactNode;
}) {
  if (!versiculo && !devocional && !children) return null;

  // La foto sale de donde la haya: del versículo o del devocional, que casi
  // siempre son la misma fila.
  const foto = versiculo?.imagenUrl ?? devocional?.imagenUrl ?? null;

  return (
    <section className="relative isolate -mx-4 overflow-hidden sm:mx-0 sm:rounded-2xl">
      {foto && (
        /*
         * `<img>` y no `next/image`: es la misma foto que ya sirve el bucket
         * público con URL permanente, y aquí va difuminada detrás de dos velos
         * — optimizarla para eso es trabajo que no se ve.
         *
         * `aria-hidden` porque es decoración: el contenido son las palabras.
         */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 size-full object-cover"
        />
      )}

      <div
        className={
          'flex flex-col ' +
          (foto
            ? 'bg-gradient-to-b from-support/80 via-[#0F1A16]/80 to-[#0B0F0D]/92 supports-backdrop-filter:from-support/62 supports-backdrop-filter:via-[#0F1A16]/72 supports-backdrop-filter:to-[#0B0F0D]/88 supports-backdrop-filter:backdrop-blur-md'
            : 'bg-support')
        }
      >
        {versiculo && (
          <div className="flex flex-col gap-2.5 px-4 py-5 text-white sm:px-5 sm:py-6">
            <span className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">
              <Quote className="size-[14px]" strokeWidth={2.2} aria-hidden />
              {versiculo.esDeHoy ? 'Versículo de hoy' : 'Versículo'}
            </span>

            {/* `text-pretty` y no `text-balance`: son dos o tres líneas de cita,
                y balance las reparte a lo ancho dejando la última casi vacía. */}
            <p className="text-pretty text-[17px] font-medium leading-[1.5] tracking-[-0.01em]">
              {versiculo.versiculo}
            </p>

            {versiculo.referencia && (
              <span className="text-[13.5px] font-semibold text-white/90">
                {versiculo.referencia}
              </span>
            )}
          </div>
        )}

        {devocional && (
          /*
           * Enlace entero y no una tarjeta con un botón dentro: en un móvil el
           * objetivo que se acierta con el pulgar es la fila, no el enlace de
           * cuatro palabras de la esquina.
           *
           * `border-white/15` en vez de `border-border`: aquí dentro el borde
           * del sistema —pensado para superficies— desaparecería sobre la foto.
           */
          <Link
            href="/mi/devocional"
            className="flex items-center gap-3 border-t border-white/15 px-4 py-3.5 text-white no-underline hover:bg-white/10 hover:no-underline sm:px-5"
          >
            <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-white/15 text-white">
              <BookOpen className="size-[18px]" strokeWidth={1.7} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/75">
                {devocional.esDeHoy ? 'Devocional de hoy' : 'Último devocional'}
              </span>

              <span className="truncate text-[15px] font-bold tracking-[-0.015em]">
                {devocional.titulo ?? 'Devocional'}
              </span>

              {/* Una línea y se corta. El extracto se recorta además en el
                  servidor: un cuerpo de tres mil caracteres viajaría entero al
                  navegador para enseñar cuarenta. */}
              <span className="truncate text-[13px] leading-snug text-white/70">
                {devocional.cuerpo}
              </span>
            </span>

            <ChevronRight
              className="size-[18px] flex-none text-white/60"
              strokeWidth={2}
              aria-hidden
            />
          </Link>
        )}

        {children && (
          /*
           * El compositor cierra la portada, que es donde el degradado está más
           * cerrado. `[&_*]` no hace falta: el propio compositor sabe vestirse
           * para esto — ver la prop `sobreFoto` en `publicador.tsx`.
           */
          <div className="border-t border-white/15 px-4 py-3.5 sm:px-5">
            {children}
          </div>
        )}
      </div>
    </section>
  );
}
