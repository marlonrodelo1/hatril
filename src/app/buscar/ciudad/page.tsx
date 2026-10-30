import Link from 'next/link';
import type { Metadata } from 'next';
import { MapPin, Search } from 'lucide-react';
import { z } from 'zod';

import {
  ciudadesDelDirectorio,
  cultoPrincipal,
  iglesiasDeCiudad,
} from '@/lib/iglesias/directorio';
import { BotonInvitar } from '../_components/boton-invitar';
import { FilaIglesia, MarcoBienvenida, nombrePais } from '../_components/fila-iglesia';

export const metadata: Metadata = { title: 'Buscar por ciudad' };

/**
 * Buscar por ciudad: la salida para quien no quiere dar su ubicación, o se la
 * ha negado a la app. Sin reñir: «verás lo mismo».
 *
 * Las sugerencias son solo ciudades donde HAY alguna iglesia. Proponer una
 * ciudad sin iglesias sería llevar a alguien a una lista vacía a propósito.
 */
const Ciudad = z.string().trim().max(80).catch('');

export default async function CiudadPage({
  searchParams,
}: {
  searchParams: Promise<{ ciudad?: string }>;
}) {
  const ciudad = Ciudad.parse((await searchParams).ciudad ?? '');

  const [ciudades, iglesias] = await Promise.all([
    ciudadesDelDirectorio(),
    ciudad.length >= 2 ? iglesiasDeCiudad(ciudad) : Promise.resolve([]),
  ]);

  const normal = (t: string) =>
    t.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLocaleLowerCase('es');
  const sugeridas = ciudad
    ? ciudades.filter((c) => normal(c.ciudad).includes(normal(ciudad)))
    : ciudades;

  return (
    <MarcoBienvenida volver="/buscar/cerca" titulo="¿En qué ciudad buscas?">
      <p className="-mt-2 text-[15px] leading-relaxed text-muted-foreground">
        Sin tu ubicación también funciona.
      </p>

      <form action="/buscar/ciudad" className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />
        <input
          type="search"
          name="ciudad"
          defaultValue={ciudad}
          autoFocus={!ciudad}
          maxLength={80}
          placeholder="Ciudad o municipio"
          aria-label="Ciudad o municipio"
          className="h-12 w-full rounded-xl border border-input bg-surface pr-3.5 pl-11 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </form>

      {iglesias.length > 0 ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
          {iglesias.map((i) => (
            <FilaIglesia key={i.id} iglesia={{ ...i, principal: cultoPrincipal(i.horarios) }} />
          ))}
        </div>
      ) : (
        <>
          {sugeridas.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
                {ciudad ? 'Quizá buscas' : 'Ciudades con iglesias en Hatril'}
              </p>
              <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
                {sugeridas.slice(0, 12).map((c) => (
                  <li key={c.ciudad + c.pais} className="border-b border-border last:border-b-0">
                    <Link
                      href={`/buscar/ciudad?ciudad=${encodeURIComponent(c.ciudad)}`}
                      className="flex items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-active"
                    >
                      <MapPin className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-semibold">{c.ciudad}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {nombrePais(c.pais)} ·{' '}
                          {c.iglesias === 1 ? '1 iglesia' : `${c.iglesias} iglesias`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ciudad.length >= 2 && (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5">
              <h2 className="text-[17px] font-bold tracking-[-0.02em]">
                Todavía no hay iglesias de Hatril en «{ciudad}»
              </h2>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                Hatril está empezando. Si tu iglesia no está, invítala: cuando
                se una, aparecerá aquí.
              </p>
              <BotonInvitar />
            </div>
          )}
        </>
      )}
    </MarcoBienvenida>
  );
}
