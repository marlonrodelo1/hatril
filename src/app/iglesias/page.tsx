import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Search, SearchX, X } from 'lucide-react';

import { buscarIglesias, totalEnDirectorio } from '@/lib/iglesias/directorio';
import { iniciales } from '@/lib/format/iniciales';
import { Logo } from '@/components/marca/logo';
import { Button } from '@/components/ui/button';
import { BotonEnlace } from '@/components/ui/boton-enlace';

export const metadata: Metadata = {
  title: 'Encuentra tu iglesia',
  description:
    'Busca tu congregación y pide unirte para estar al día de lo que hace.',
};

/**
 * Directorio público de iglesias.
 *
 * NO SE PARECE A UN MARKETPLACE, Y ES A PROPÓSITO
 * -----------------------------------------------
 * Nada de valoraciones, ni de «destacadas», ni de orden por popularidad. Se
 * ordena alfabéticamente y punto. Esto no es un sitio donde comparar productos:
 * quien llega ya sabe a qué iglesia va y solo necesita encontrarla.
 *
 * El buscador va por GET, con un formulario nativo. No hace falta JavaScript ni
 * un `useState`: la búsqueda es una URL, se puede compartir y el botón atrás
 * funciona.
 */
export default async function DirectorioPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const busqueda = q?.trim();

  const [iglesias, total] = await Promise.all([
    buscarIglesias(busqueda),
    totalEnDirectorio(),
  ]);

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[1000px] items-center gap-6 px-5 py-3.5 md:px-8">
          <Link
            href="/"
            aria-label="Hatril, ir a la portada"
            className="rounded-sm no-underline outline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Logo variante="logotipo" tamano={22} />
          </Link>
          <span className="flex-1" />
          <BotonEnlace href="/acceso" variant="outline" size="sm">
            Entrar
          </BotonEnlace>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1000px] flex-col gap-8 px-5 py-12 md:px-8 md:py-16">
        <div className="flex flex-col gap-4">
          <h1 className="text-pretty text-[32px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[40px]">
            Encuentra tu iglesia
          </h1>
          <p className="max-w-[560px] text-pretty text-[17px] leading-relaxed text-muted-foreground">
            Busca tu congregación y pide unirte. Cuando alguien del equipo lo
            apruebe, verás lo que publican y en qué anda la comunidad.
          </p>
        </div>

        <form method="GET" className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex flex-1 items-center">
            <Search
              className="pointer-events-none absolute left-3.5 size-[18px] text-muted-foreground"
              strokeWidth={1.8}
            />
            {/* `key` con la búsqueda: al volver a «todas» con el botón de borrar
                la navegación es de cliente, y un campo no controlado conserva
                lo escrito aunque cambie su `defaultValue`. Con otra clave se
                monta de nuevo, vacío.

                16 px en el móvil y 15 desde `md`, como `<Input>`: por debajo de
                16, Safari amplía la página al enfocar el campo. */}
            <input
              key={busqueda ?? ''}
              type="search"
              name="q"
              defaultValue={busqueda ?? ''}
              placeholder="Nombre de la iglesia o ciudad…"
              aria-label="Buscar iglesias"
              className="peer h-12 w-full rounded-lg border border-border bg-surface-alt pr-12 pl-11 text-[16px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16 md:text-[15px] [&::-webkit-search-cancel-button]:appearance-none"
            />
            <BorrarBusqueda activa={Boolean(busqueda)} />
          </div>
          <Button type="submit" size="lg" className="sm:w-auto">
            Buscar
          </Button>
        </form>

        {iglesias.length === 0 ? (
          <Vacio busqueda={busqueda} total={total} />
        ) : (
          <div className="flex flex-col gap-3">
            <p className="t-label text-muted-foreground">
              {busqueda
                ? `${iglesias.length} ${iglesias.length === 1 ? 'resultado' : 'resultados'}`
                : `${total} ${total === 1 ? 'iglesia' : 'iglesias'} en Hatril`}
            </p>

            {iglesias.map((i) => (
              <div
                key={i.id}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5 sm:flex-row sm:items-center"
              >
                {/* El logo si la iglesia lo ha subido: es lo que reconoce quien
                    la busca, más que dos iniciales que comparten media docena
                    de «Iglesia Betania». */}
                {i.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={i.logoUrl}
                    alt=""
                    className="size-12 flex-none rounded-xl border border-border bg-surface object-cover"
                  />
                ) : (
                  <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-accent text-body font-bold text-accent-foreground">
                    {iniciales(i.nombre)}
                  </span>
                )}

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[17px] font-bold tracking-[-0.018em]">
                    {i.nombre}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-muted-foreground">
                    {i.ciudad && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" strokeWidth={1.8} />
                        {i.ciudad}
                      </span>
                    )}
                    {i.denominacion && <span>· {i.denominacion}</span>}
                  </span>

                  {i.descripcion && (
                    <p className="line-clamp-2 text-pretty text-[14px] leading-snug text-muted-foreground">
                      {i.descripcion}
                    </p>
                  )}
                </div>

                <div className="flex flex-none flex-wrap gap-2">
                  <BotonEnlace href={`/i/${i.slug}`}
                    variant="outline">
                    Ver la iglesia
                  </BotonEnlace>
                  {/* Carbón y no naranja: un solo botón naranja por pantalla, y
                      aquí ese es «Buscar». Al revés no encaja: «Pedir unirme»
                      se repite en cada tarjeta, así que naranja serían tantos
                      como iglesias, y buscar es lo único que siempre está y lo
                      primero que hace quien llega. El carbón lo deja por
                      encima de «Ver la iglesia», que va en contorno. */}
                  {i.aceptaSolicitudes && (
                    <BotonEnlace href={`/solicitar/${i.slug}`}
                      variant="secondary">
                      Pedir unirme
                    </BotonEnlace>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

/**
 * La equis del buscador, que borra lo escrito. Sin JavaScript, como el resto
 * del buscador.
 *
 * Solo se ve con algo escrito: el campo lleva `peer` y esto se esconde con
 * `peer-placeholder-shown`, que el navegador recalcula con cada tecla sin que
 * nadie escuche nada. De ahí que tenga que ir DESPUÉS del campo.
 *
 * DOS FORMAS, SEGÚN HAYA O NO UNA BÚSQUEDA HECHA
 * ----------------------------------------------
 *   - Sin búsqueda en la URL, un `reset`: devuelve el campo a su valor inicial,
 *     que es vacío. Al instante y sin ir a ningún sitio.
 *   - Con búsqueda, un enlace a `/iglesias`. Ahí un `reset` devolvería el campo
 *     a lo buscado, no a vacío; y lo que quiere quien la borra es volver a ver
 *     todas, no quedarse con un campo en blanco sobre los resultados de antes.
 */
function BorrarBusqueda({ activa }: { activa: boolean }) {
  const clases =
    'absolute right-1.5 flex size-9 items-center justify-center rounded-lg text-muted-foreground no-underline outline-none transition-colors duration-150 peer-placeholder-shown:hidden hover:bg-surface-active hover:text-foreground hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none';

  return activa ? (
    <Link href="/iglesias" aria-label="Borrar la búsqueda" className={clases}>
      <X className="size-[18px]" strokeWidth={1.8} />
    </Link>
  ) : (
    <button type="reset" aria-label="Borrar lo escrito" className={clases}>
      <X className="size-[18px]" strokeWidth={1.8} />
    </button>
  );
}

function Vacio({ busqueda, total }: { busqueda?: string; total: number }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-6" strokeWidth={1.8} />
      </span>

      <div className="flex max-w-[420px] flex-col gap-1.5">
        <span className="text-[18px] font-bold tracking-[-0.02em]">
          {busqueda ? 'No encontramos esa iglesia' : 'Todavía no hay iglesias'}
        </span>
        <span className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          {busqueda
            ? total > 0
              ? 'Puede que tu iglesia esté en Hatril pero no se haya publicado en el directorio. Pregúntales a ellos y te pasarán el enlace.'
              : 'Todavía no hay ninguna iglesia publicada aquí.'
            : 'En cuanto haya congregaciones publicadas, aparecerán en esta lista.'}
        </span>
      </div>

      {busqueda && (
        <BotonEnlace href="/iglesias" variant="outline">
          Ver todas
        </BotonEnlace>
      )}
    </div>
  );
}
