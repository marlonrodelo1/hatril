import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChevronLeft, Info, Mail, MapPin, Navigation, Phone } from 'lucide-react';
import { clsx } from 'clsx';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { fichaDeIglesia } from '@/lib/iglesias/directorio';
import { iniciales } from '@/lib/format/iniciales';
import { BotonEnlace } from '@/components/ui/boton-enlace';
import { nombrePais } from '../../buscar/_components/fila-iglesia';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const iglesia = await fichaDeIglesia((await params).slug);
  return { title: iglesia?.nombre ?? 'Iglesia' };
}

/**
 * La ficha de una iglesia en la app, antes de pedir entrar.
 *
 * Más corta que su web (`/i/[slug]`): quien llega aquí desde la búsqueda quiere
 * saber si es la suya, dónde está y cuándo se reúne, y pedir entrar. Un solo
 * naranja, «Pedir unirme», y nada que sugiera entrada directa: siempre aprueba
 * el pastor. Se llamaba «Solicitar ser miembro»; ahora dice lo mismo que el
 * directorio, porque la misma acción lleva el mismo botón en todas partes.
 *
 * EL REDISEÑO DEL 17-NOV (zona 3, pieza «Unirse»)
 * -----------------------------------------------
 *   - Arriba, la foto de la iglesia con el logo montado sobre el borde. Antes
 *     no había ninguna aunque la iglesia las tuviera en su web, y es lo que
 *     hace reconocer el sitio a quien ya ha ido alguna vez. `bannerUrl` es la
 *     primera de sus `imagenes`, duplicada a propósito para esto (schema). Sin
 *     foto, el logo encabeza la ficha y no queda ningún hueco gris.
 *   - El botón, fijo abajo, al alcance del pulgar: con cuatro horarios y la
 *     dirección, antes quedaba debajo del pliegue en un móvil pequeño.
 *
 * TRES VARIANTES, Y NINGUNA ES UN ERROR
 * -------------------------------------
 *   - La iglesia no acepta solicitudes por la app: gestiona las altas en
 *     persona, y se dan su teléfono y su correo.
 *   - Quien mira ya es de otra iglesia, o tiene una solicitud pendiente: en
 *     Hatril se es de una sola, así que no hay botón de solicitar. La base lo
 *     admitiría —el unique es por pareja—; la regla la pone la aplicación.
 *   - Quien mira ya es de ESTA: a su muro.
 *
 * Solo lo que es un botón va en el pie fijo. Las variantes que explican algo
 * van al final de la ficha: un párrafo pegado al borde de la pantalla taparía
 * media ficha en el móvil.
 */
export default async function FichaIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const iglesia = await fichaDeIglesia((await params).slug);
  if (!iglesia) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ctx, solicitud] = user
    ? await Promise.all([getCurrentUserContext(), solicitudDeUsuario(user.id)])
    : [null, null];

  const pendiente = solicitud?.estado === 'pendiente' ? solicitud : null;

  const horarios = [...iglesia.horarios].sort(
    (a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)),
  );
  // «Bogotá, Colombia»: con coma, para que no se confunda con el punto medio
  // que la separa de la denominación.
  const lugar = [iglesia.ciudad, nombrePais(iglesia.pais)].filter(Boolean).join(', ');

  const destinoMapa =
    iglesia.latitud !== null && iglesia.longitud !== null
      ? `${iglesia.latitud},${iglesia.longitud}`
      : [iglesia.direccion, iglesia.ciudad].filter(Boolean).join(', ');

  // El mismo orden de antes: ser de esta gana a todo, ser de otra gana a
  // tener una solicitud, y solo sin nada de eso cuenta si acepta solicitudes.
  const esDeEsta = ctx?.iglesia.id === iglesia.id;
  const puedePedir = !ctx && !pendiente && iglesia.aceptaSolicitudes;

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col">
        {iglesia.bannerUrl ? (
          <div className="relative sm:mt-4 sm:px-5">
            {/* La proporción del diseño (340 × 120): en el móvil la foto dice
                qué sitio es sin empujar el nombre fuera de la pantalla. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iglesia.bannerUrl}
              alt=""
              className="aspect-[17/6] w-full bg-surface-active object-cover sm:rounded-xl"
            />
            {/* Encima de la foto, blanco sobre un velo: es lo único que se lee
                con cualquier imagen debajo, y la regla 5 lo permite ahí. */}
            <Link
              href="/buscar"
              aria-label="Volver a buscar"
              className="absolute top-2 left-2 flex size-11 items-center justify-center rounded-full bg-black/40 text-white no-underline outline-none hover:bg-black/55 hover:text-white focus-visible:ring-3 focus-visible:ring-white/60 sm:left-7"
            >
              <ChevronLeft className="size-5" strokeWidth={1.8} />
            </Link>
            <span className="absolute -bottom-7 left-5 sm:left-10">
              <Logo iglesia={iglesia} montado />
            </span>
          </div>
        ) : (
          <header className="flex items-center px-2 pt-2">
            <Link
              href="/buscar"
              aria-label="Volver a buscar"
              className="flex size-11 items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              <ChevronLeft className="size-5" strokeWidth={1.8} />
            </Link>
          </header>
        )}

        <div
          className={clsx(
            'flex flex-1 flex-col gap-6 px-5 pb-8',
            iglesia.bannerUrl ? 'pt-10' : 'pt-2',
          )}
        >
          <div className="flex flex-col gap-3">
            {!iglesia.bannerUrl && <Logo iglesia={iglesia} />}
            <div className="flex min-w-0 flex-col gap-0.5">
              <h1 className="t-titulo text-balance">{iglesia.nombre}</h1>
              <span className="text-label text-muted-foreground">
                {[iglesia.denominacion, lugar].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>

          {iglesia.descripcion && (
            <p className="text-pretty text-body leading-relaxed">{iglesia.descripcion}</p>
          )}

          {horarios.length > 0 && (
            <section className="flex flex-col gap-2.5">
              <h2 className="t-micro px-1">Horarios</h2>
              {/* Compacta: el nombre a un lado y cuándo al otro, una línea por
                  reunión. La web de la iglesia tiene la semana entera; aquí
                  basta con saber si encaja. */}
              <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                {horarios.map((h, i) => (
                  <li
                    key={i}
                    className="flex items-baseline justify-between gap-3 border-b border-border px-4 py-2.5 last:border-b-0"
                  >
                    <span className="min-w-0 text-body font-semibold">{h.nombre}</span>
                    <span className="flex-none text-body text-muted-foreground tabular-nums">
                      {h.dia} · {h.hora}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {(iglesia.direccion || iglesia.ciudad) && (
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <MapPin className="size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
              <span className="flex min-w-0 flex-1 flex-col">
                {iglesia.direccion && (
                  <span className="text-body font-semibold">{iglesia.direccion}</span>
                )}
                {iglesia.ciudad && (
                  <span className="text-label text-muted-foreground">{iglesia.ciudad}</span>
                )}
              </span>
              {destinoMapa && (
                <BotonEnlace
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinoMapa)}`}
                  nuevaPestana
                  variant="outline"
                  size="sm"
                >
                  <Navigation strokeWidth={1.8} />
                  Ir<span className="sr-only">: abrir la dirección en el mapa</span>
                </BotonEnlace>
              )}
            </div>
          )}

          {ctx && !esDeEsta ? (
            <Bloque titulo={`Ya eres de ${ctx.iglesia.nombre}`}>
              En Hatril se es de una sola iglesia. Si quieres cambiarte, primero
              habla con tu pastor para salir de la tuya; después podrás pedir
              entrar aquí.
            </Bloque>
          ) : !ctx && pendiente ? (
            <Bloque
              titulo={
                pendiente.iglesiaSlug === iglesia.slug
                  ? 'Ya pediste entrar aquí'
                  : `Tienes una solicitud pendiente en ${pendiente.iglesiaNombre}`
              }
              accion={
                <BotonEnlace href="/mi" variant="outline" className="self-start">
                  Ver mi solicitud
                </BotonEnlace>
              }
            >
              {pendiente.iglesiaSlug === iglesia.slug
                ? 'Tu solicitud está con el pastor. Te avisaremos cuando responda.'
                : 'Solo se puede ser de una iglesia. Para pedir entrar aquí, cancela antes esa solicitud.'}
            </Bloque>
          ) : !ctx && !iglesia.aceptaSolicitudes ? (
            <Bloque
              titulo="Esta iglesia gestiona las altas en persona"
              accion={
                (iglesia.telefono || iglesia.email) && (
                  <div className="flex flex-wrap gap-2">
                    {iglesia.telefono && (
                      <BotonEnlace href={`tel:${iglesia.telefono}`} variant="outline">
                        <Phone strokeWidth={1.8} />
                        Llamar
                      </BotonEnlace>
                    )}
                    {iglesia.email && (
                      <BotonEnlace href={`mailto:${iglesia.email}`} variant="outline">
                        <Mail strokeWidth={1.8} />
                        Escribir
                      </BotonEnlace>
                    )}
                  </div>
                )
              }
            >
              Ven a un culto y pregunta por el equipo de acogida
              {iglesia.telefono || iglesia.email ? ', o escríbeles antes.' : '.'}
            </Bloque>
          ) : null}

          {iglesia.webPublica && (
            <Link
              href={`/i/${iglesia.slug}`}
              className="self-center text-label font-semibold text-foreground underline underline-offset-2 hover:text-foreground"
            >
              Ver la web de la iglesia
            </Link>
          )}
        </div>
      </main>

      {(esDeEsta || puedePedir) && (
        // Pegado abajo mientras se baja por la ficha. El cristal solo donde el
        // navegador sabe hacerlo: sin desenfoque, un fondo translúcido deja
        // leer a medias lo que pasa por debajo (como la barra de `/mi`).
        <div className="sticky bottom-0 z-10 border-t border-border bg-surface pb-[calc(0.875rem+env(safe-area-inset-bottom))] supports-backdrop-filter:bg-surface/90 supports-backdrop-filter:backdrop-blur-md">
          <div className="mx-auto flex w-full max-w-[560px] flex-col gap-1.5 px-5 pt-2.5">
            {esDeEsta ? (
              <BotonEnlace href="/mi" size="lg" className="w-full">
                Ya eres de esta iglesia: entrar
              </BotonEnlace>
            ) : (
              <>
                <BotonEnlace href={`/solicitar/${iglesia.slug}`} size="lg" className="w-full">
                  Pedir unirme
                </BotonEnlace>
                <p className="text-center text-label text-pretty text-muted-foreground">
                  El pastor revisa cada solicitud y te avisamos cuando responda.
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * El logo de la iglesia, o sus iniciales si no ha subido ninguno.
 *
 * `montado` es el que va encima del borde de la foto: el aro del color del
 * fondo lo despega de la imagen sin sombra (regla 3).
 */
function Logo({
  iglesia,
  montado = false,
}: {
  iglesia: { nombre: string; logoUrl: string | null };
  montado?: boolean;
}) {
  return iglesia.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iglesia.logoUrl}
      alt=""
      className={clsx(
        'size-16 flex-none rounded-xl bg-surface object-cover',
        montado ? 'border-[3px] border-background' : 'border border-border',
      )}
    />
  ) : (
    <span
      className={clsx(
        'flex size-16 flex-none items-center justify-center rounded-xl bg-accent text-subtitle font-bold text-accent-foreground',
        montado && 'border-[3px] border-background',
      )}
    >
      {iniciales(iglesia.nombre)}
    </span>
  );
}

function Bloque({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
        <div className="flex flex-col gap-1">
          <p className="text-body font-semibold">{titulo}</p>
          <p className="text-pretty text-label leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </div>
      {accion}
    </div>
  );
}
