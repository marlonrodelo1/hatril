import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { Mail, MapPin, Phone, Play, UsersRound } from 'lucide-react';

import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { redesParaPintar } from '@/lib/iglesias/redes';
import { eventosPublicos } from '@/lib/eventos/publica';
import { EventosIglesia } from './_components/eventos';
import type { Moneda } from '@/lib/db/schema';
import { iniciales } from '@/lib/format/iniciales';
import { formatearTelefono } from '@/lib/telefono/normalizar';
import { Button } from '@/components/ui/button';
import { CarruselIglesia } from './_components/carrusel';
import { CabeceraIglesia } from './_components/cabecera';
import { GruposApilados } from './_components/grupos-apilados';
// Importada, no en `public/`: así Next conoce su alto y su ancho sin que haya
// que escribirlos a mano, reserva el hueco antes de descargarla —nada salta al
// cargar— y genera el `blur` de mientras.
import ilustracionComunidad from './_components/comunidad.avif';
import { proximaReunion } from '@/lib/iglesias/proxima-reunion';
import { devocionalPublico } from '@/lib/devocionales/consultas';
import { pulsoDelMuro } from '@/lib/comunidad/consultas';
import { formatearFechaLarga } from '@/lib/fecha/hoy';

/**
 * La web pública de una iglesia.
 *
 * ISR de 60 segundos: es una página que cambia dos veces al año y que puede
 * recibir una punta de visitas cuando la congregación la comparte por WhatsApp.
 * Sin esto, cada visita sería dos consultas a Irlanda.
 *
 * El `revalidate` hay que ponerlo explícito porque las consultas van por Drizzle
 * y no por `fetch`: Next no las ve y trataría la página como dinámica.
 *
 * QUÉ TRAE DATOS DE VERDAD Y QUÉ NO
 * ---------------------------------
 * Los grupos son los ministerios reales de la iglesia. Del diseño faltan tres
 * bloques y los tres por el mismo motivo —no hay de dónde sacarlos todavía—:
 *
 *   - «El domingo pasado vinieron 142 personas»  → asistencias (v2)
 *   - La agenda de lo próximo                    → eventos (v2)
 *   - El desglose de en qué se gasta lo donado   → finanzas (v2)
 *
 * Se dejan fuera enteros en vez de rellenarlos con cifras de ejemplo. Esta es
 * la página que la iglesia enseña a quien no la conoce: un dato inventado aquí
 * no es un detalle de maqueta, es la primera impresión.
 */
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) return { title: 'Iglesia no encontrada' };

  const descripcion =
    iglesia.descripcion ??
    `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}. Horarios, grupos y cómo llegar.`;

  return {
    // `absolute` para saltarse la plantilla «%s · Hatril»: esta es la web de la
    // iglesia, no una pantalla de nuestro producto. Que su nombre salga en la
    // pestaña acompañado de nuestra marca es apropiarse de algo que no es
    // nuestro.
    title: { absolute: `${iglesia.nombre}${iglesia.ciudad ? ` · ${iglesia.ciudad}` : ''}` },
    description: descripcion,
    openGraph: {
      title: iglesia.nombre,
      description: descripcion,
      type: 'website',
      images: iglesia.imagenes[0] ? [iglesia.imagenes[0]] : undefined,
    },
  };
}

export default async function WebIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const iglesia = await obtenerIglesiaPublica(slug);

  if (!iglesia) notFound();

  const destacado = iglesia.horarios.find((h) => h.destacado);
  const proxima = proximaReunion(iglesia.horarios, iglesia.timezone);
  const devocional = await devocionalPublico(iglesia.id, iglesia.timezone);
  const pulso = await pulsoDelMuro(iglesia.id);
  const tieneContacto = Boolean(
    iglesia.direccion || iglesia.telefono || iglesia.email,
  );
  // Tolerante a lo que haya guardado: la columna es de la migración `0000` y
  // puede traer claves anteriores al catálogo. Se ignoran en vez de tumbar la
  // web de la iglesia.
  const redes = redesParaPintar(iglesia.redes);
  // Va por `dbAdmin`, como todo lo de esta página, y NO consulta inscripciones:
  // ni siquiera para contarlas. El porqué, en `src/lib/eventos/publica.ts`.
  const eventosDeLaIglesia = await eventosPublicos(iglesia.id);
  const monedaIglesia = iglesia.moneda as Moneda;
  const secciones: { href: string; texto: string }[] = [];
  if (iglesia.horarios.length > 0) {
    secciones.push({ href: '#horarios', texto: 'Horarios' });
  }
  // Entre horarios y devocional, en el MISMO orden en que se pintan más abajo.
  if (eventosDeLaIglesia.length > 0) {
    secciones.push({ href: '#eventos', texto: 'Eventos' });
  }
  if (devocional) {
    secciones.push({ href: '#devocional', texto: 'Devocional' });
  }
  // El orden de este array es el del menú, y tiene que ser el mismo en el que
  // aparecen las secciones al bajar. Si discrepan, los enlaces saltan hacia
  // arriba y hacia abajo y la página parece desordenada.
  if (iglesia.grupos.length > 0) {
    secciones.push({ href: '#grupos', texto: 'Grupos' });
  }
  secciones.push({ href: '#comunidad', texto: 'Comunidad' });
  if (tieneContacto) {
    secciones.push({ href: '#contacto', texto: 'Contacto' });
  }

  return (
    <div className="bg-background">
      {/* El logo si lo han subido; si no, las iniciales. Nunca un hueco: una
          cabecera con un cuadro vacío parece rota. */}
      <CabeceraIglesia
        nombre={iglesia.nombre}
        ciudad={iglesia.ciudad}
        logoUrl={iglesia.logoUrl}
        iniciales={iniciales(iglesia.nombre)}
        secciones={secciones}
        tieneContacto={tieneContacto}
        donativos={
          iglesia.cuentaDonativos
            ? {
                cuenta: iglesia.cuentaDonativos,
                titular: iglesia.titularDonativos,
              }
            : null
        }
      />

      {/* --- Hero --- */}
      {/*
       * El texto va DENTRO del carrusel, sobre las fotos.
       *
       * Eso obliga a un velo oscuro encima de cada imagen para que se lea, que
       * es una capa que el sistema de diseño no usa en ningún otro sitio. Es una
       * excepción a propósito y solo aquí: es la primera pantalla que ve alguien
       * que no conoce la iglesia, y ahí manda la foto del sitio.
       *
       * Cuando NO hay fotos, se pinta el mismo contenido sin carrusel y con los
       * colores normales. Una iglesia recién dada de alta no tiene ninguna, y
       * su página no puede verse rota por eso.
       */}
      {iglesia.imagenes.length > 0 ? (
        <section className="mx-auto max-w-[1180px] px-4 pt-4 sm:px-5 md:px-10 md:pt-6">
          <CarruselIglesia imagenes={iglesia.imagenes} nombre={iglesia.nombre}>
            {/*
             * Sin `mx-auto`: el texto arranca donde arranca todo lo demás.
             *
             * Con él, el bloque quedaba centrado dentro del hero y en un monitor
             * empezaba 210px dentro del borde, mientras los títulos de las
             * secciones de abajo empiezan a 40. Se veía como un escalón al bajar
             * de la primera pantalla a la segunda.
             */}
            <div className="flex flex-col gap-5 md:max-w-[760px] md:gap-6 lg:max-w-[880px]">
              {destacado && (
                <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-white/15 py-1.5 pl-2.5 pr-3.5 text-[12.5px] font-semibold text-white backdrop-blur-sm sm:text-[13px]">
                  <span className="size-[7px] flex-none rounded-full bg-white" />
                  Nos reunimos {destacado.dia.toLowerCase()} a las{' '}
                  {destacado.hora}
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
              <h1 className="text-pretty text-[clamp(32px,9vw,58px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white">
                {iglesia.descripcion
                  ? 'Puedes venir tal como estás'
                  : iglesia.nombre}
              </h1>

              {iglesia.descripcion && (
                <p className="max-w-[560px] text-pretty text-[16px] leading-relaxed text-white/85 sm:text-[17px] md:text-[19px]">
                  {iglesia.descripcion}
                </p>
              )}

              {/* A ancho completo y apilados en el móvil. Los dos botones piden
                  326px juntos y en un teléfono de 320 quedan 232 útiles: se
                  partían igual, pero cada uno a dos tercios de línea y con un
                  hueco al lado. Apilados a propósito se leen como dos opciones y
                  se pulsan con el pulgar sin apuntar. */}
              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                {tieneContacto && (
                  <Button size="lg" render={<a href="#contacto" />}>
                    <MapPin strokeWidth={1.8} />
                    Cómo llegar
                  </Button>
                )}
                {iglesia.horarios.length > 0 && (
                  // Sobre la foto, el secundario va en cristal en vez de blanco
                  // opaco: así se ve la imagen a través y los dos botones no
                  // parecen dos parches pegados encima.
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 active:bg-white/25"
                    render={<a href="#horarios" />}
                  >
                    Ver los horarios
                  </Button>
                )}
              </div>
            </div>
          </CarruselIglesia>
        </section>
      ) : (
        <section className="mx-auto max-w-[1180px] px-4 pt-8 sm:px-5 md:px-10 md:pt-14">
          <div className="flex flex-col gap-5 md:max-w-[720px] md:gap-6">
            {destacado && (
              <span className="inline-flex w-fit items-center gap-2.5 rounded-full bg-accent py-1.5 pl-2.5 pr-3.5 text-[12.5px] font-semibold text-accent-foreground sm:text-[13px]">
                <span className="size-[7px] flex-none rounded-full bg-primary" />
                Nos reunimos {destacado.dia.toLowerCase()} a las {destacado.hora}
              </span>
            )}

            {/* La misma escala fluida que el hero con foto: son el mismo
                titular y no pueden medir cosas distintas. */}
            <h1 className="text-pretty text-[clamp(32px,9vw,58px)] font-extrabold leading-[1.04] tracking-[-0.035em]">
              {iglesia.descripcion
                ? 'Puedes venir tal como estás'
                : iglesia.nombre}
            </h1>

            {iglesia.descripcion && (
              <p className="max-w-[560px] text-pretty text-[16px] leading-relaxed text-muted-foreground sm:text-[17px] md:text-[19px]">
                {iglesia.descripcion}
              </p>
            )}

            {/* Lo mismo que en el hero con foto: apilados y a ancho completo
                mientras no haya sitio para los dos en una línea. */}
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              {tieneContacto && (
                <Button size="lg" render={<a href="#contacto" />}>
                  <MapPin strokeWidth={1.8} />
                  Cómo llegar
                </Button>
              )}
              {iglesia.horarios.length > 0 && (
                <Button
                  size="lg"
                  variant="outline"
                  render={<a href="#horarios" />}
                >
                  Ver los horarios
                </Button>
              )}
            </div>
          </div>
        </section>
      )}

      {/* --- Horarios --- */}
      {iglesia.horarios.length > 0 && (
        // `scroll-mt` en todas las secciones con ancla: la cabecera flota por
        // encima, y sin este margen el título de la sección aterriza debajo de
        // ella. Se nota justo en el gesto más usado de la página —pulsar
        // «Horarios»— y parece que el enlace ha fallado.
        <section
          id="horarios"
          className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
        >
          <div className="mb-8 flex flex-col gap-3">
            <span className="t-micro text-[#9C3A11]">Cuándo nos vemos</span>
            <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
              Horarios de la semana
            </h2>
          </div>

          {/* Lo próximo, arriba y en grande. Es la pregunta que trae a alguien
              aquí, y hasta ahora había que deducirla mirando la lista. */}
          {proxima && (
            <div className="mb-6 flex flex-col gap-5 rounded-2xl border border-border bg-support p-6 text-white md:flex-row md:items-center md:justify-between md:p-8">
              <div className="flex min-w-0 flex-col gap-2">
                <span className="t-micro text-white/70">Lo próximo</span>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-[26px] font-extrabold leading-tight tracking-[-0.03em] md:text-[32px]">
                    {proxima.horario.nombre}
                  </span>
                  <span className="text-[17px] font-semibold text-white/80">
                    {proxima.cuando} a las {proxima.horario.hora}
                  </span>
                </div>
                {proxima.horario.detalle && (
                  <p className="max-w-[520px] text-pretty text-[14.5px] leading-relaxed text-white/75">
                    {proxima.horario.detalle}
                  </p>
                )}
              </div>

              {tieneContacto && (
                <Button
                  variant="outline"
                  size="lg"
                  className="flex-none"
                  render={<a href="#contacto" />}
                >
                  <MapPin strokeWidth={1.8} />
                  Cómo llegar
                </Button>
              )}
            </div>
          )}

          {/*
           * `auto-fit` en vez de escalones fijos.
           *
           * Con `sm:grid-cols-2 lg:grid-cols-3` el número de columnas lo decidía
           * el ancho de la pantalla sin mirar cuántos horarios hay: una iglesia
           * con cuatro reuniones dejaba una tarjeta sola en la última fila en
           * escritorio, y una con dos las estiraba a media pantalla cada una.
           * Así las columnas salen de dividir el ancho disponible entre 230px, y
           * la rejilla se adapta igual a un móvil que a un monitor.
           *
           * El `min(100%,230px)` es lo que evita el desbordamiento en pantallas
           * de menos de 230px de contenido útil, que es lo que queda en un móvil
           * de 320 con el sangrado de la página.
           */}
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,230px),1fr))] gap-4">
            {iglesia.horarios.map((h, i) => {
              const esLaProxima = proxima?.horario === h;

              return (
                <div
                  key={`${h.dia}-${h.hora}-${i}`}
                  className={
                    'flex flex-col gap-3 rounded-xl border bg-surface-alt p-5 ' +
                    // La próxima lleva el borde de color en vez de repetir la
                    // tarjeta grande: se reconoce sin duplicar la información.
                    (esLaProxima ? 'border-support' : 'border-border')
                  }
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
                      {h.dia}
                    </span>
                    {h.destacado && (
                      <span className="whitespace-nowrap rounded-full bg-accent px-2.5 py-[4px] text-[11.5px] font-bold text-accent-foreground">
                        Ven aquí
                      </span>
                    )}
                  </div>

                  <span className="text-[34px] font-extrabold leading-none tracking-[-0.03em] tabular-nums">
                    {h.hora}
                  </span>

                  <div className="flex flex-col gap-1">
                    <span className="text-[16px] font-bold tracking-[-0.015em]">
                      {h.nombre}
                    </span>
                    {h.detalle && (
                      <span className="text-pretty text-[13.5px] leading-relaxed text-muted-foreground">
                        {h.detalle}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* --- Eventos ---
          Entre los horarios y el devocional a propósito: los horarios son lo
          que se repite cada semana y esto es lo que pasa UNA vez, así que se
          leen seguidos. Y el orden de este bloque tiene que ser el mismo que el
          del array `secciones`: la marca verde del menú recorre ese array y se
          queda con la última sección que ha pasado la línea de lectura, así que
          si discrepan se queda pegada en la equivocada. */}
      {eventosDeLaIglesia.length > 0 && (
        <section
          id="eventos"
          className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
        >
          <div className="mb-7 flex flex-col gap-2">
            <span className="t-micro">Lo próximo</span>
            <h2 className="text-[clamp(24px,4vw,32px)] font-extrabold leading-tight tracking-[-0.03em]">
              Eventos
            </h2>
          </div>

          <EventosIglesia
            eventos={eventosDeLaIglesia}
            slug={iglesia.slug}
            timezone={iglesia.timezone}
            moneda={monedaIglesia}
          />
        </section>
      )}

      {/* --- Devocional --- */}
      {devocional && (
        <section
          id="devocional"
          className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
        >
          {/*
           * UN PANEL DE CRISTAL SOBRE LA FOTO, PERO SIN TAPARLA ENTERA
           *
           * El desenfoque cubría la tarjeta completa: la iglesia subía una foto
           * y en la web salía una mancha gris. Se descargaba igual. Y el texto
           * llegaba a medir 1002px de ancho en un monitor —más de cien
           * caracteres por línea, el doble de lo que se lee de corrido—.
           *
           * El cristal sigue, que es lo que le da el aire a esta sección, pero
           * ocupa lo que ocupa el texto y no más: la fotografía se ve alrededor.
           * El velo va debajo del panel, así que el contraste no depende de si
           * la iglesia subió una imagen clara o una oscura.
           */}
          <article
            className={
              'relative flex items-center overflow-hidden rounded-2xl border border-border ' +
              (devocional.imagenUrl ? 'md:min-h-[520px]' : 'bg-surface')
            }
          >
            {devocional.imagenUrl && (
              <>
                <Image
                  src={devocional.imagenUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1180px) calc(100vw - 80px), 1100px"
                  className="object-cover"
                />
                <div
                  aria-hidden="true"
                  className="absolute inset-0 bg-[#1A1A1A]/40"
                />
              </>
            )}

            <div
              className={
                'relative flex w-full max-w-[720px] flex-col gap-6 ' +
                (devocional.imagenUrl
                  ? 'm-3 rounded-2xl border border-white/25 bg-[#1A1A1A]/30 p-6 text-white supports-[backdrop-filter]:backdrop-blur-xl sm:m-5 sm:p-8 md:m-8 md:p-10'
                  : 'p-6 sm:p-8 md:p-10 lg:p-12')
              }
            >
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={
                    't-micro ' +
                    (devocional.imagenUrl ? '!text-white/75' : 'text-[#9C3A11]')
                  }
                >
                  {devocional.esDeHoy ? 'Devocional de hoy' : 'Último devocional'}
                </span>
                {!devocional.esDeHoy && (
                  <span
                    className={
                      'text-[13px] ' +
                      (devocional.imagenUrl
                        ? 'text-white/75'
                        : 'text-muted-foreground')
                    }
                  >
                    {formatearFechaLarga(devocional.fecha)}
                  </span>
                )}
              </div>

              {devocional.versiculo && (
                // El versículo va en grande y el comentario debajo: es lo que la
                // gente comparte por WhatsApp, y lo que se lee aunque no se lea
                // nada más.
                <blockquote
                  className={
                    'flex flex-col gap-3 border-l-2 pl-5 md:pl-6 ' +
                    (devocional.imagenUrl ? 'border-white/60' : 'border-support')
                  }
                >
                  <p className="max-w-[26ch] text-pretty text-[21px] font-semibold leading-[1.35] tracking-[-0.02em] sm:text-[23px] md:text-[26px]">
                    {devocional.versiculo}
                  </p>
                  {devocional.referencia && (
                    <cite
                      className={
                        'text-[14.5px] font-semibold not-italic ' +
                        (devocional.imagenUrl ? 'text-white/85' : 'text-support')
                      }
                    >
                      {devocional.referencia}
                    </cite>
                  )}
                </blockquote>
              )}

              {devocional.titulo && (
                <h2 className="text-pretty text-[24px] font-extrabold leading-tight tracking-[-0.03em] md:text-[30px]">
                  {devocional.titulo}
                </h2>
              )}

              {/* 60 caracteres y no 68: el panel ya es estrecho, y el límite
                  solo tiene que evitar que en un monitor de 2560px la línea se
                  estire. */}
              <div className="flex max-w-[60ch] flex-col gap-4">
                {devocional.cuerpo
                  .split(/\n\s*\n/)
                  .map((p) => p.trim())
                  .filter(Boolean)
                  .map((p, i) => (
                    <p
                      key={i}
                      className={
                        'text-pretty text-[16.5px] leading-[1.75] ' +
                        (devocional.imagenUrl ? 'text-white/95' : 'text-foreground')
                      }
                    >
                      {p}
                    </p>
                  ))}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                {/*
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
                 */}
                {devocional.videoUrl && (
                  <Button
                    variant="outline"
                    className={
                      devocional.imagenUrl
                        ? 'border-white/30 bg-white/10 text-white backdrop-blur-md hover:bg-white/20 active:bg-white/25'
                        : ''
                    }
                    render={
                      <a
                        href={devocional.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      />
                    }
                  >
                    <Play strokeWidth={1.8} />
                    Verlo en vídeo
                  </Button>
                )}

                {devocional.autorNombre && (
                  <span
                    className={
                      'text-[14px] ' +
                      (devocional.imagenUrl
                        ? 'text-white/75'
                        : 'text-muted-foreground')
                    }
                  >
                    {devocional.autorNombre}
                  </span>
                )}
              </div>
            </div>
          </article>
        </section>
      )}

      {/* --- Grupos: los ministerios reales --- */}
      {iglesia.grupos.length > 0 && (
        <section
          id="grupos"
          className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
        >
          <div className="mb-9 flex flex-col gap-3">
            <span className="t-micro text-[#9C3A11]">Grupos y ministerios</span>
            <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
              Puedes sumarte a cualquiera
            </h2>
            <p className="max-w-[520px] text-[15px] leading-relaxed text-muted-foreground">
              Se entra probando, sin compromiso.
            </p>
          </div>

          <GruposApilados grupos={iglesia.grupos} />
        </section>
      )}

      {/*
       * Aquí iba «Quiénes somos»: la historia de la iglesia, sus datos en
       * píldoras y el resto plegado.
       *
       * Fuera por ahora; su sitio lo va a ocupar la comunidad. El texto NO se ha
       * borrado: sigue en `iglesias.historia` y se sigue escribiendo desde
       * Ajustes, así que recuperarlo es volver a pintar una sección, no
       * reescribirla.
       */}

      {/*
       * Aquí había una franja verde a todo lo ancho con el número de cuenta.
       *
       * Se fue al botón «Donar» de la cabecera. Pedir dinero es lo único de esta
       * página que nadie lee de paso —se busca a propósito o no se hace—, y una
       * banda entre los grupos y el contacto interrumpía a quien venía a mirar a
       * qué hora es el culto. El dato no se ha perdido: ahora está a un toque
       * desde cualquier punto de la página, que antes no lo estaba.
       */}

      {/* --- Comunidad --- */}
      {/*
       * UNA INVITACIÓN, NO UNA VENTANA
       *
       * Aquí NO se pinta ni una publicación, ni un nombre, ni una foto. Esta
       * página la ve cualquiera con el enlace y sin cuenta: enseñar quién
       * escribe en el muro de una iglesia es publicar quién pertenece a esa
       * iglesia, y eso es dato del artículo 9 del RGPD.
       *
       * Lo único que sale de dentro es un recuento, que no identifica a nadie, y
       * sirve para lo que tiene que servir: que se note que hay vida y que a
       * alguien le entren ganas de entrar.
       */}
      <section
        id="comunidad"
        className="scroll-mt-20 border-y border-border bg-surface"
      >
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-4 py-14 sm:px-5 md:grid-cols-[1fr_auto] md:gap-12 md:px-10 md:py-16 lg:py-20">
          <div className="flex flex-col gap-3">
            <span className="t-micro text-[#9C3A11]">La comunidad</span>
            <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
              Lo que pasa entre domingo y domingo
            </h2>
            <p className="max-w-[520px] text-pretty text-[16px] leading-relaxed text-muted-foreground">
              {pulso.publicaciones > 0
                ? 'Fotos, avisos y peticiones de oración que la congregación comparte durante la semana. Se ve desde dentro: hace falta ser de la iglesia.'
                : 'El sitio donde la congregación comparte durante la semana. Se ve desde dentro: hace falta ser de la iglesia.'}
            </p>

            {pulso.ultimaSemana > 0 && (
              <span className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-surface-alt py-2 pl-3 pr-4 text-[13.5px] font-semibold">
                <span className="size-2 rounded-full bg-support" />
                {pulso.ultimaSemana}{' '}
                {pulso.ultimaSemana === 1
                  ? 'publicación esta semana'
                  : 'publicaciones esta semana'}
              </span>
            )}

            {/* «Ver la comunidad» se fue dentro del cartel de la ilustración,
                que estaba en blanco justamente para eso. Aquí se queda la acción
                de quien todavía no es de la iglesia, que es casi todo el que
                llega a esta página. */}
            {iglesia.aceptaSolicitudes && (
              <Button
                size="lg"
                variant="outline"
                className="mt-2 w-full sm:w-fit"
                render={<Link href={`/solicitar/${iglesia.slug}`} />}
              >
                Quiero ser parte
              </Button>
            )}
          </div>

          {/*
           * La ilustración va DESPUÉS en el HTML: en un móvil, quien entra lee
           * primero de qué va esto y ve el dibujo debajo, no al revés. En
           * escritorio la rejilla la coloca a la derecha.
           *
           * DENTRO DE UN MARCO, Y NO SUELTA
           * -------------------------------
           * El dibujo trae su propio fondo azul claro, que sobre el crema de esta
           * sección se vería como un parche pegado. Con el borde de 1px y las
           * esquinas redondeadas del sistema pasa a leerse como un cuadro: el
           * color de dentro ya no compite con el de la página, está enmarcado.
           *
           * El ancho de la columna se fija aquí para que el dibujo no crezca a
           * costa del texto en un monitor: la rejilla es `1fr auto`, así que sin
           * un tope la ilustración se lleva lo que quiera.
           */}
          <div className="relative w-full md:w-[360px] lg:w-[440px]">
            <Image
              src={ilustracionComunidad}
              alt=""
              // Decorativa: lo que cuenta ya está escrito al lado, y un lector de
              // pantalla que la describiera solo repetiría el titular peor.
              aria-hidden="true"
              sizes="(max-width: 768px) 100vw, 440px"
              className="h-auto w-full rounded-2xl border border-border"
              placeholder="blur"
            />

            {/*
             * El botón, dentro del cartel que sostiene la gente del dibujo.
             *
             * LOS PORCENTAJES ESTÁN MEDIDOS, NO ELEGIDOS A OJO
             * ------------------------------------------------
             * El primer intento puso el botón centrado en la imagen y se salía
             * del cartel por la izquierda y por abajo, encima de la gente. El
             * cartel no está centrado ni ocupa lo que parece: leyendo los píxeles
             * de la ilustración, la zona blanca libre va del 31% al 71% del ancho
             * —centro en 51%, no en 50— y del 28% al 47% del alto. Por debajo del
             * 47% empiezan las cabezas de las figuras de delante.
             *
             * Con porcentajes, el botón sigue dentro del cartel a cualquier
             * tamaño de pantalla; con píxeles habría que recalcularlo en cada
             * punto de ruptura.
             *
             * Sin icono y con `whitespace-normal`: en un móvil el cartel mide
             * unos 127px y el botón del sistema viene con `whitespace-nowrap`,
             * así que el texto tiene que poder partirse en dos líneas en vez de
             * desbordar. El icono se comería la mitad del ancho útil.
             */}
            <div className="absolute left-[52%] top-[38%] w-[34%] -translate-x-1/2 -translate-y-1/2">
              {/* El latido va en este envoltorio y no en el botón: el botón del
                  sistema lleva `active:translate-y-px` y dos reglas peleándose
                  por el mismo `transform` le hacen pegar un salto al pulsarlo. */}
              <div className="latido-suave">
                {/*
                 * Naranja de marca, y aquí SÍ cabe.
                 *
                 * La regla del sistema es un solo botón naranja por pantalla, no
                 * uno por página: el del hero queda tres secciones más arriba y
                 * no llegan a verse juntos nunca. En este bloque el otro botón
                 * —«Quiero ser parte»— va de contorno, así que este es el único
                 * relleno y el ojo va a él, que es lo que se busca.
                 *
                 * El icono va ENCIMA y no al lado: al lado se come 24 de los 127
                 * píxeles que mide el cartel en un móvil.
                 *
                 * Y el aire está contado. Con `gap-1`, `py-2` y el texto a 12,5px
                 * el botón medía 75px y el hueco blanco del cartel son 74: se
                 * salía por arriba, justo encima de las cabezas de la fila de
                 * atrás. Apretando el interlineado y el hueco entre icono y texto
                 * baja a 61 y entra con margen. Por eso estos valores son los que
                 * son y no los de por defecto del sistema.
                 */}
                <Button
                  className="h-auto w-full flex-col gap-0.5 whitespace-normal px-2 py-1.5 text-center text-[12px] leading-tight sm:text-[13px]"
                  render={<Link href="/mi/comunidad" />}
                >
                  <UsersRound strokeWidth={1.8} className="size-[16px]" />
                  Ver la comunidad
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- Contacto --- */}
      {tieneContacto && (
        <section
          id="contacto"
          className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
        >
          <div className="grid items-start gap-10 md:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="t-micro text-[#9C3A11]">Cómo llegar y contacto</span>
              <h2 className="text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
                ¿Alguna pregunta antes de venir?
              </h2>
              <p className="max-w-[460px] text-pretty text-[17px] leading-relaxed text-muted-foreground">
                Escribe o llama y contesta una persona de la iglesia.
              </p>
            </div>

            {/*
             * Datos de contacto directos, no un formulario.
             *
             * El diseño pone aquí un formulario con la promesa de que «contesta
             * una persona, normalmente el mismo día». Para cumplirla hacen falta
             * una bandeja en el panel y avisos por correo, y hasta que existan,
             * un formulario que no va a ninguna parte incumple justo esa
             * promesa: alguien escribe con una duda antes de atreverse a
             * aparecer un domingo, y nadie lo lee nunca.
             *
             * Un teléfono en el que llamar y un correo al que escribir sí
             * funcionan hoy. Y desde el móvil, que es por donde va a entrar casi
             * todo el mundo, `tel:` y `mailto:` son un toque.
             */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6">
              {iglesia.direccion && (
                <DatoContacto Icono={MapPin} titulo={iglesia.direccion}>
                  {iglesia.ciudad}
                </DatoContacto>
              )}

              {iglesia.telefono && (
                <DatoContacto
                  Icono={Phone}
                  titulo={formatearTelefono(iglesia.telefono)}
                  href={`tel:${iglesia.telefono}`}
                >
                  Llama y te contamos lo que necesites saber.
                </DatoContacto>
              )}

              {iglesia.email && (
                <DatoContacto
                  Icono={Mail}
                  titulo={iglesia.email}
                  href={`mailto:${iglesia.email}`}
                >
                  Escríbenos con toda tranquilidad.
                </DatoContacto>
              )}
            </div>
          </div>
        </section>
      )}

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 py-9 sm:px-5 md:flex-row md:items-center md:px-10">
          <div className="flex flex-none items-center gap-[11px]">
            <span className="flex size-[34px] flex-none items-center justify-center rounded-[9px] bg-primary text-[13px] font-bold text-primary-foreground">
              {iniciales(iglesia.nombre)}
            </span>
            <div className="flex flex-col">
              <span className="text-[14.5px] font-bold tracking-[-0.015em]">
                {iglesia.nombre}
              </span>
              {iglesia.direccion && (
                <span className="text-[12.5px] text-muted-foreground">
                  {iglesia.direccion}
                </span>
              )}
            </div>
          </div>

          {/* Las redes van AQUÍ y no en la cabecera, aunque parezca el sitio
              obvio: la píldora de arriba ya va justa a 1024px —por eso «Mi
              cuenta» es solo icono y solo cabe un botón de acción— y cinco
              enlaces más la rompen. Además no son una sección de la página, así
              que no entran en el menú de anclas.

              Sin iconos de marca, y no por pereza: lucide 1.x retiró
              `Instagram`, `Facebook` y `Youtube`, y dibujar logotipos a mano
              junto a un juego de iconos coherente se ve peor que el nombre
              escrito. Si algún día vuelven, aquí es donde entran. */}
          {redes.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2">
              {redes.map(({ red, titulo, url }) => (
                <li key={red}>
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${iglesia.nombre} en ${titulo}`}
                    className="flex h-8 items-center rounded-full border border-border bg-surface-alt px-3.5 text-[13px] font-semibold text-muted-foreground no-underline transition-colors hover:bg-background hover:text-foreground hover:no-underline"
                  >
                    {titulo}
                  </a>
                </li>
              ))}
            </ul>
          )}

          {/* `hidden` en móvil: en columna este separador no empuja nada, pero
              sigue contando como hijo del flex y duplica el hueco entre el logo
              y los enlaces legales. */}
          <span className="hidden flex-1 md:block" />

          <div className="flex flex-wrap items-center gap-5">
            <Link
              href="/privacidad"
              className="text-[13.5px] text-muted-foreground no-underline hover:text-foreground hover:no-underline"
            >
              Privacidad
            </Link>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground">
              Hecho con{' '}
              <Link href="/" className="font-bold">
                Hatril
              </Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function DatoContacto({
  Icono,
  titulo,
  href,
  children,
}: {
  Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  titulo: string;
  href?: string;
  children?: React.ReactNode;
}) {
  const contenido = (
    <>
      <Icono
        className="mt-0.5 size-[19px] flex-none text-muted-foreground"
        strokeWidth={1.7}
      />
      {/* `min-w-0` y `break-words`: un correo largo o una dirección con nombre
          de barrio no tienen dónde partir y estiran la tarjeta hasta sacarla de
          la pantalla en un móvil. */}
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[15.5px] font-semibold break-words text-foreground">
          {titulo}
        </span>
        {children && (
          <span className="text-[14px] leading-snug text-muted-foreground">
            {children}
          </span>
        )}
      </span>
    </>
  );

  if (!href) {
    return <div className="flex items-start gap-3">{contenido}</div>;
  }

  return (
    <a
      href={href}
      className="-mx-2 flex items-start gap-3 rounded-lg px-2 py-2 no-underline hover:bg-background hover:no-underline"
    >
      {contenido}
    </a>
  );
}
