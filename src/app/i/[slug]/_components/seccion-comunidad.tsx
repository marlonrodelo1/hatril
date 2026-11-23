import Image from 'next/image';
import Link from 'next/link';
import { clsx } from 'clsx';
import { ArrowRight } from 'lucide-react';

import type { IglesiaPublica } from '@/lib/iglesias/publica';
import type { pulsoDelMuro } from '@/lib/comunidad/consultas';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { Insignia } from '@/components/ui/insignia';

type Pulso = Awaited<ReturnType<typeof pulsoDelMuro>>;

/**
 * La invitación a la comunidad.
 *
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
 *
 * La foto de fondo NO rompe esa regla: es de `iglesias.imagenes`, las que la
 * propia iglesia sube para su web y que ya salen en la portada. Ninguna sale
 * del muro, y no debe salir nunca: una foto de una publicación enseña a quien
 * la subió y a quien sale en ella.
 *
 * SU FOTO, NO UN DIBUJO
 * ---------------------
 * Aquí había una ilustración genérica de gente, de las que hay en mil webs:
 * no era esta iglesia. Ahora la invitación va sobre una foto suya, y si no
 * tiene ninguna, en la versión clara y sin imagen. Una tarjeta con un hueco
 * gris donde debería ir la foto se lee como un fallo de carga.
 */
export function SeccionComunidad({
  iglesia,
  pulso,
}: {
  iglesia: IglesiaPublica;
  pulso: Pulso;
}) {
  // La última y no la primera: la primera es la que abre la portada, y
  // repetirla aquí haría que el final de la página pareciera el principio.
  // Con una sola foto se usa esa, que es mejor que ninguna.
  const foto = iglesia.imagenes.at(-1) ?? null;
  const conFoto = foto !== null;

  return (
    <section
      id="comunidad"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 pt-14 sm:px-5 md:px-10 md:pt-16 lg:pt-20"
    >
      <div
        className={clsx(
          'relative isolate flex overflow-hidden rounded-2xl border border-border',
          conFoto
            ? 'min-h-[340px] items-end md:min-h-[440px]'
            : 'bg-surface',
        )}
      >
        {foto && (
          <>
            <Image
              src={foto}
              // Decorativa: lo que cuenta ya está escrito encima, y la misma
              // foto ya lleva su descripción en la portada.
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1180px) calc(100vw - 80px), 1100px"
              className="-z-10 object-cover"
            />
            {/*
             * El velo, plano y no en degradado: el sistema solo admite uno, el
             * de la portada del muro. Al 55 %, el mismo que el carrusel de la
             * portada y las tarjetas de los grupos de esta página, y no el
             * `bg-velo` de las ventanas (42 %): ese apaga una pantalla de la
             * aplicación, no garantiza que se lea texto blanco sobre una foto
             * que no controlamos. Con una imagen clara, al 42 % el texto
             * pequeño se queda por debajo de 3:1.
             */}
            <div aria-hidden className="absolute inset-0 -z-10 bg-black/55" />
          </>
        )}

        <div
          className={clsx(
            'flex w-full flex-col items-start gap-3 p-5 sm:p-8 md:max-w-[720px] md:p-12',
            conFoto && 'text-white',
          )}
        >
          <span className={clsx('t-micro', conFoto ? 'text-white/85' : 'text-badge-accent-fg')}>
            La comunidad
          </span>
          <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
            Lo que pasa entre domingo y domingo
          </h2>
          <p
            className={clsx(
              'max-w-[520px] text-pretty text-[16px] leading-relaxed',
              conFoto ? 'text-white/90' : 'text-muted-foreground',
            )}
          >
            {pulso.publicaciones > 0
              ? 'Fotos, avisos y peticiones de oración que la congregación comparte durante la semana. Se ve desde dentro: hace falta ser de la iglesia.'
              : 'El sitio donde la congregación comparte durante la semana. Se ve desde dentro: hace falta ser de la iglesia.'}
          </p>

          {pulso.ultimaSemana > 0 && (
            <Insignia tono="neutro" punto>
              {pulso.ultimaSemana}{' '}
              {pulso.ultimaSemana === 1
                ? 'publicación esta semana'
                : 'publicaciones esta semana'}
            </Insignia>
          )}

          <div className="mt-2 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-5">
            {/*
             * Claro y no naranja. La regla es un solo botón naranja por
             * pantalla, y el de esta página es el «Cómo llegar» de la portada:
             * es lo que viene a buscar casi todo el que llega. Sobre la foto
             * va en el blanco de las tarjetas para que destaque sobre el velo;
             * sin foto, el de contorno de siempre.
             */}
            {iglesia.aceptaSolicitudes && (
              <BotonEnlace
                href={`/solicitar/${iglesia.slug}`}
                size="lg"
                variant="outline"
                className={clsx(
                  'w-full sm:w-fit',
                  conFoto &&
                    'border-transparent bg-surface text-foreground hover:bg-surface-alt active:bg-surface-active',
                )}
              >
                Quiero ser parte
                <ArrowRight strokeWidth={1.8} aria-hidden />
              </BotonEnlace>
            )}

            {/*
             * La puerta de los que ya son de la iglesia, en discreto.
             *
             * Antes iba dentro del cartel de la ilustración y en naranja, y
             * competía con la acción de quien todavía no es de la iglesia,
             * que es casi todo el que llega a esta página. Quien ya es de
             * dentro la busca y la encuentra; no hace falta gritársela.
             */}
            <Link
              href="/mi/comunidad"
              className={clsx(
                'w-fit text-label font-semibold underline underline-offset-4',
                conFoto
                  ? 'text-white hover:text-white'
                  : 'text-foreground hover:text-foreground',
              )}
            >
              ¿Ya eres de la iglesia? Ver la comunidad
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
