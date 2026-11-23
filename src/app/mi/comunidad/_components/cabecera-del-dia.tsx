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
 * LA FOTO TIENE QUE VERSE, Y ESO CAMBIÓ LOS NÚMEROS
 * --------------------------------------------------
 * El primer intento llevaba el velo a 0.82 y un desenfoque de 12px: el texto se
 * leía perfecto y la imagen quedaba irreconocible —«se ve distorsionada, no se
 * aprecia»—. Si la foto no se distingue, no hace falta foto: bastaba el fondo
 * liso.
 *
 * Ahora son tres capas medidas al revés, empezando por lo que se quiere ver:
 *
 *   1. La **foto**, a tamaño completo y prácticamente limpia. El desenfoque baja
 *      a 1.5px: quita el ruido de grano sin borrar la escena.
 *   2. El **degradado**, que empieza en 0.25 arriba —donde la imagen tiene que
 *      respirar— y cierra en 0.80 abajo, que es donde caen el devocional y el
 *      compositor, las líneas pequeñas.
 *   3. La **sombra del texto**, que es lo que sustituye a la opacidad que se ha
 *      quitado. Sobre el trozo claro de una foto, un blanco sin sombra
 *      desaparece; con ella se lee igual sobre cielo que sobre montaña, y NO es
 *      la sombra que prohíbe la regla 3 —esa habla de dar profundidad a las
 *      cajas, no de despegar una letra de su fondo.
 *
 * La guarda `supports-backdrop-filter` se queda para el desenfoque. El degradado
 * no la necesita: es color plano y funciona en cualquier navegador.
 *
 * SIN FOTO, EN LA PALETA DE LA MARCA (19-nov)
 * -------------------------------------------
 * Era el carbón liso con letra blanca, y a Marlon no le gustaba: «ese color
 * gris de fondo no me gusta, que pegue con el crema o con el naranja
 * quemado». Ahora, sin foto, la portada es el naranja suave (`bg-accent`) con
 * la letra oscura, la etiqueta en el naranja de leer sobre ese fondo
 * (`text-accent-foreground`) y el compositor en su tarjeta clara. Sin foto no
 * se inventa ninguna: un hueco donde iría la imagen se lee como un fallo de
 * carga.
 */

/** Las clases de cada parte, con foto detrás (cristal y blanco) y sin ella. */
const CON_FOTO = {
  fondo:
    'bg-gradient-to-b from-black/25 via-black/45 to-black/80 supports-backdrop-filter:backdrop-blur-[1.5px]',
  texto: 'text-white drop-shadow-[0_1px_3px_rgb(0_0_0/0.55)]',
  etiqueta: 'text-white',
  secundario: 'text-white/90',
  borde: 'border-white/15',
  fila: 'hover:bg-white/10',
  icono: 'bg-white/15 text-white',
  etiquetaFila: 'text-white/75',
  extracto: 'text-white/70',
  flecha: 'text-white/60',
};

const SIN_FOTO = {
  fondo: 'bg-accent',
  texto: 'text-foreground',
  etiqueta: 'text-accent-foreground',
  secundario: 'text-accent-foreground',
  borde: 'border-primary/15',
  fila: 'hover:bg-accent-soft-active',
  icono: 'bg-surface text-primary',
  etiquetaFila: 'text-accent-foreground',
  extracto: 'text-muted-foreground',
  flecha: 'text-accent-foreground',
};
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
  const t = foto ? CON_FOTO : SIN_FOTO;

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

      <div className={'flex flex-col ' + t.fondo}>
        {versiculo && (
          <div className={'flex flex-col gap-2.5 px-4 py-5 sm:px-5 sm:py-6 ' + t.texto}>
            <span className={'flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] ' + t.etiqueta}>
              <Quote className="size-[14px]" strokeWidth={2.2} aria-hidden />
              {versiculo.esDeHoy ? 'Versículo de hoy' : 'Versículo'}
            </span>

            {/* `text-pretty` y no `text-balance`: son dos o tres líneas de cita,
                y balance las reparte a lo ancho dejando la última casi vacía. */}
            <p className="text-pretty text-[17px] font-medium leading-[1.5] tracking-[-0.01em]">
              {versiculo.versiculo}
            </p>

            {versiculo.referencia && (
              <span className={'text-[13.5px] font-semibold ' + t.secundario}>
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
            className={
              'flex items-center gap-3 border-t px-4 py-3.5 no-underline hover:no-underline sm:px-5 ' +
              `${t.borde} ${t.texto} ${t.fila}`
            }
          >
            <span className={'flex size-10 flex-none items-center justify-center rounded-lg ' + t.icono}>
              <BookOpen className="size-[18px]" strokeWidth={1.7} />
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className={'text-[11px] font-semibold uppercase tracking-[0.08em] ' + t.etiquetaFila}>
                {devocional.esDeHoy ? 'Devocional de hoy' : 'Último devocional'}
              </span>

              <span className="truncate text-[15px] font-bold tracking-[-0.015em]">
                {devocional.titulo ?? 'Devocional'}
              </span>

              {/* Una línea y se corta. El extracto se recorta además en el
                  servidor: un cuerpo de tres mil caracteres viajaría entero al
                  navegador para enseñar cuarenta. */}
              <span className={'truncate text-[13px] leading-snug ' + t.extracto}>
                {devocional.cuerpo}
              </span>
            </span>

            <ChevronRight
              className={'size-[18px] flex-none ' + t.flecha}
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
          <div className={'border-t px-4 py-3.5 sm:px-5 ' + t.borde}>{children}</div>
        )}
      </div>
    </section>
  );
}
