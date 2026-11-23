import { MapPin } from 'lucide-react';
import { clsx } from 'clsx';

import type { IglesiaPublica } from '@/lib/iglesias/publica';
import type { HorarioSemanal } from '@/lib/db/schema';
import { indiceDia } from '@/lib/iglesias/proxima-reunion';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { CarruselIglesia } from './carrusel';

/** Con su tilde: `indiceDia` compara sin ella, pero aquí se escribe. */
const NOMBRES_DIA = [
  'domingo',
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
] as const;

/**
 * «Este domingo a las 11:00», que es lo aprobado en la presentación.
 *
 * El día lo escribe el pastor a mano y llega «Domingo», «domingos» o «Dom»
 * (ver `proxima-reunion.ts`): con «Este» delante, «Este domingos» se lee mal.
 * Se normaliza al nombre del día, y si no se reconoce se vuelve a la frase de
 * antes, que admite cualquier cosa sin inventarse un día.
 *
 * No dice «Hoy» ni «El próximo» aunque lo sepa calcular: la página se regenera
 * como mucho cada minuto, pero la versión guardada se sirve hasta que alguien
 * la pide, y un «Hoy» de hace tres días es peor que un «Este domingo».
 */
function cuandoNosReunimos(destacado: HorarioSemanal): string {
  const i = indiceDia(destacado.dia);
  return i === null
    ? `Nos reunimos ${destacado.dia.toLowerCase()} a las ${destacado.hora}`
    : `Este ${NOMBRES_DIA[i]} a las ${destacado.hora}`;
}

/**
 * La primera pantalla de la web de la iglesia.
 *
 * El texto va DENTRO del carrusel, sobre las fotos, y la foto va a sangre: de
 * borde a borde y por debajo de la cabecera, que empieza transparente (zona 3
 * del rediseño, aprobada el 17-nov). Antes iba en una tarjeta con margen y en
 * el móvil se quedaba pequeña.
 *
 * Eso obliga a un velo oscuro encima de cada imagen para que se lea, que
 * es una capa que el sistema de diseño no usa en ningún otro sitio. Es una
 * excepción a propósito y solo aquí: es la primera pantalla que ve alguien
 * que no conoce la iglesia, y ahí manda la foto del sitio.
 *
 * Cuando NO hay fotos, se pinta el mismo contenido sin carrusel y con los
 * colores normales, y la cabecera es sólida desde el principio. Una iglesia
 * recién dada de alta no tiene ninguna, y su página no puede verse rota por
 * eso.
 */
export function SeccionPortada({
  iglesia,
  destacado,
  tieneContacto,
}: {
  iglesia: IglesiaPublica;
  destacado: HorarioSemanal | undefined;
  tieneContacto: boolean;
}) {
  const conHorarios = iglesia.horarios.length > 0;
  const dosBotones = tieneContacto && conHorarios;

  if (iglesia.imagenes.length > 0) {
    return (
      <section aria-label={iglesia.nombre}>
        <CarruselIglesia imagenes={iglesia.imagenes} nombre={iglesia.nombre}>
          {/*
           * Sin `mx-auto`: el texto arranca donde arranca todo lo demás.
           *
           * Con él, el bloque quedaba centrado dentro del hero y en un monitor
           * empezaba 210px dentro del borde, mientras los títulos de las
           * secciones de abajo empiezan a 40. Se veía como un escalón al bajar
           * de la primera pantalla a la segunda.
           */}
          <div className="flex flex-col gap-4 md:max-w-[680px] md:gap-6">
            {destacado && (
              /*
               * La pastilla sobre la foto va en cristal y escrita a mano, no
               * con `Insignia`: sus cinco tonos son fondos claros pensados para
               * el crema, y sobre la foto parecerían una pegatina.
               */
              <span className="inline-flex h-7 w-fit items-center gap-2 rounded-full border border-white/30 bg-white/16 px-3 text-label font-semibold text-white">
                <span
                  aria-hidden
                  className="size-1.5 flex-none rounded-full bg-white"
                />
                {cuandoNosReunimos(destacado)}
              </span>
            )}

            {/*
             * `clamp` en vez de dos escalones.
             *
             * Con `text-[40px] md:text-[58px]`, el titular ocupaba tres líneas
             * en un móvil de 320px y dejaba fuera de la foto todo lo demás.
             * Entre 320 y 768 no había ningún escalón intermedio, que es donde
             * viven casi todos los móviles. Ahora crece con el ancho: 32px en
             * el más pequeño, 58 a partir de 645.
             */}
            <h1 className="text-balance text-[clamp(32px,9vw,58px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white">
              {iglesia.descripcion
                ? 'Puedes venir tal como estás'
                : iglesia.nombre}
            </h1>

            {iglesia.descripcion && (
              /*
               * Blanco entero y no `text-white/85` como antes: sobre el peor
               * punto de una foto (blanco puro bajo el velo), el 85 % se
               * quedaba en 3.9:1 y la descripción es texto de lectura, no un
               * titular. La jerarquía la dan ya el tamaño y el peso.
               */
              <p className="max-w-[560px] text-pretty text-[16px] leading-relaxed text-white sm:text-[17px] md:text-[19px]">
                {iglesia.descripcion}
              </p>
            )}

            {/*
             * Lado a lado desde 360px, como en el prototipo aprobado, y
             * apilados por debajo. Juntos piden unos 310px: en un teléfono de
             * 320 quedan 288 útiles y se salían, mientras que a partir de 360
             * caben con su icono y sin partir la palabra. Con uno solo, a
             * todo el ancho: media fila vacía al lado parece que falta algo.
             */}
            {(tieneContacto || conHorarios) && (
              <div
                className={clsx(
                  'grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3',
                  dosBotones && 'min-[360px]:grid-cols-2',
                )}
              >
                {tieneContacto && (
                  <BotonEnlace nativo href="#contacto" size="lg" className="px-4 sm:px-5">
                    <MapPin strokeWidth={1.8} />
                    Cómo llegar
                  </BotonEnlace>
                )}
                {conHorarios && (
                  // Sobre la foto, el secundario va en cristal en vez de blanco
                  // opaco: así se ve la imagen a través y los dos botones no
                  // parecen dos parches pegados encima.
                  <BotonEnlace
                    nativo
                    href="#horarios"
                    size="lg"
                    variant="outline"
                    className="border-white/40 bg-white/14 px-4 text-white hover:bg-white/24 hover:text-white active:bg-white/28 sm:px-5"
                  >
                    Ver horarios
                  </BotonEnlace>
                )}
              </div>
            )}
          </div>
        </CarruselIglesia>
      </section>
    );
  }

  return (
    // La cabecera va por encima del contenido (no ocupa sitio, ver
    // `CabeceraIglesia`), así que aquí arriba se le deja su hueco: su alto más
    // el aire que esta portada llevaba antes.
    <section className="mx-auto max-w-[1180px] px-4 pt-[calc(4rem+env(safe-area-inset-top)+2rem)] sm:px-5 md:px-10 md:pt-[calc(4rem+env(safe-area-inset-top)+3.5rem)] xl:pt-[calc(5rem+env(safe-area-inset-top)+3.5rem)]">
      <div className="flex flex-col gap-5 md:max-w-[720px] md:gap-6">
        {destacado && (
          <span className="inline-flex h-7 w-fit items-center gap-2 rounded-full bg-accent px-3 text-label font-semibold text-accent-foreground">
            <span aria-hidden className="size-1.5 flex-none rounded-full bg-primary" />
            {cuandoNosReunimos(destacado)}
          </span>
        )}

        {/* La misma escala fluida que el hero con foto: son el mismo
            titular y no pueden medir cosas distintas. */}
        <h1 className="text-balance text-[clamp(32px,9vw,58px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
          {iglesia.descripcion
            ? 'Puedes venir tal como estás'
            : iglesia.nombre}
        </h1>

        {iglesia.descripcion && (
          <p className="max-w-[560px] text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px] md:text-[19px]">
            {iglesia.descripcion}
          </p>
        )}

        {/* Lo mismo que en el hero con foto: lado a lado desde 360px, y uno
            solo a todo el ancho. */}
        {(tieneContacto || conHorarios) && (
          <div
            className={clsx(
              'grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-3',
              dosBotones && 'min-[360px]:grid-cols-2',
            )}
          >
            {tieneContacto && (
              <BotonEnlace nativo href="#contacto" size="lg" className="px-4 sm:px-5">
                <MapPin strokeWidth={1.8} />
                Cómo llegar
              </BotonEnlace>
            )}
            {conHorarios && (
              <BotonEnlace
                nativo
                href="#horarios"
                size="lg"
                variant="outline"
                className="px-4 sm:px-5"
              >
                Ver horarios
              </BotonEnlace>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
