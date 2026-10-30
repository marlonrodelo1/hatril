import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Search } from 'lucide-react';
import { z } from 'zod';

import { buscarIglesias, cultoPrincipal } from '@/lib/iglesias/directorio';
import { buttonVariants } from '@/components/ui/button';
import { BotonInvitar } from './_components/boton-invitar';
import { FilaIglesia, MarcoBienvenida } from './_components/fila-iglesia';

export const metadata: Metadata = { title: 'Busca tu iglesia' };

/**
 * «Ya soy de una iglesia»: buscarla por su nombre.
 *
 * Por GET, como el directorio de la web: la búsqueda es una URL, el botón atrás
 * funciona y no hace falta JavaScript. Busca en el nombre, la ciudad y la
 * denominación, y pinta la ciudad siempre, porque «Betania» hay muchas.
 */
const Busqueda = z.string().trim().max(80).catch('');

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = Busqueda.parse((await searchParams).q ?? '');
  const resultados = q.length >= 2 ? await buscarIglesias(q) : [];

  // Si salen varias con el mismo nombre, se avisa: la ciudad es la que manda.
  const nombres = new Map<string, number>();
  for (const r of resultados) {
    const n = r.nombre.toLocaleLowerCase('es');
    nombres.set(n, (nombres.get(n) ?? 0) + 1);
  }
  const repetidas = [...nombres.values()].some((n) => n > 1);

  return (
    <MarcoBienvenida volver="/empezar" titulo="Busca tu iglesia">
      <form action="/buscar" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />
        <input
          type="search"
          name="q"
          defaultValue={q}
          autoFocus={!q}
          maxLength={80}
          placeholder="Nombre de la iglesia"
          aria-label="Nombre de la iglesia"
          className="h-12 w-full rounded-xl border border-input bg-surface pr-3.5 pl-11 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </form>

      {q.length >= 2 && resultados.length > 0 && (
        <>
          <p className="text-[14px] text-muted-foreground">
            {repetidas
              ? `${resultados.length} iglesias con este nombre. Fíjate en la ciudad.`
              : resultados.length === 1
                ? '1 iglesia'
                : `${resultados.length} iglesias`}
          </p>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {resultados.map((r) => (
              <FilaIglesia
                key={r.id}
                iglesia={{ ...r, principal: cultoPrincipal(r.horarios) }}
              />
            ))}
          </div>
          <p className="text-[14px] text-muted-foreground">
            ¿No la ves? Prueba con otra palabra del nombre.
          </p>
        </>
      )}

      {q.length >= 2 && resultados.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-[17px] font-bold tracking-[-0.02em]">
            No encontramos «{q}»
          </h2>
          <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
            Puede que tu iglesia aún no esté en Hatril o que aparezca con otro
            nombre. Prueba con una sola palabra.
          </p>
          <div className="flex w-full flex-col gap-2 pt-1">
            <BotonInvitar />
            <Link
              href="/buscar/cerca"
              className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' w-full'}
            >
              <MapPin strokeWidth={1.8} />
              Buscar cerca de mí
            </Link>
          </div>
        </div>
      )}

      {q.length < 2 && (
        <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          Escribe el nombre de tu iglesia, o una palabra de él. También puedes
          buscar por la ciudad.
        </p>
      )}
    </MarcoBienvenida>
  );
}
