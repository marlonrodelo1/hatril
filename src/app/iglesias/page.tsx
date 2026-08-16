import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Search, SearchX } from 'lucide-react';

import { buscarIglesias, totalEnDirectorio } from '@/lib/iglesias/directorio';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';

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
            className="text-[17px] font-extrabold tracking-[-0.02em] text-foreground no-underline hover:no-underline"
          >
            Hatril
          </Link>
          <span className="flex-1" />
          <Button variant="outline" size="sm" render={<Link href="/acceso" />}>
            Entrar
          </Button>
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
              strokeWidth={1.6}
            />
            <input
              type="search"
              name="q"
              defaultValue={busqueda ?? ''}
              placeholder="Nombre de la iglesia o ciudad…"
              aria-label="Buscar iglesias"
              className="h-12 w-full rounded-lg border border-border bg-surface-alt pl-11 pr-3 text-[15.5px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
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
                <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-accent text-[15px] font-bold text-accent-foreground">
                  {iniciales(i.nombre)}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-[17px] font-bold tracking-[-0.018em]">
                    {i.nombre}
                  </span>

                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13.5px] text-muted-foreground">
                    {i.ciudad && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3.5" strokeWidth={1.7} />
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
                  <Button
                    variant="outline"
                    render={<Link href={`/i/${i.slug}`} />}
                  >
                    Ver la iglesia
                  </Button>
                  {i.aceptaSolicitudes && (
                    <Button render={<Link href={`/solicitar/${i.slug}`} />}>
                      Pedir unirme
                    </Button>
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

function Vacio({ busqueda, total }: { busqueda?: string; total: number }) {
  return (
    <div className="flex flex-col items-center gap-3.5 rounded-xl border border-border bg-surface px-6 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-full bg-background text-muted-foreground">
        <SearchX className="size-6" strokeWidth={1.5} />
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
        <Button variant="outline" render={<Link href="/iglesias" />}>
          Ver todas
        </Button>
      )}
    </div>
  );
}
