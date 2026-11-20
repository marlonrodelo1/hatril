import Link from 'next/link';
import type { ComponentProps } from 'react';
import { MapPin } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { BotonInvitar } from './boton-invitar';
import { BuscadorIglesias } from './buscador';
import { FilaIglesia, MarcoBienvenida, type IglesiaEnLista } from './fila-iglesia';

/**
 * «Busca tu iglesia», sin consultar nada.
 *
 * Salió de `../page.tsx` el 20-nov para que la pinten igual la web y la app
 * empaquetada (`movil/`). La app le pasa al buscador de dónde sacar las
 * sugerencias y qué hacer al buscar (`buscador`).
 */
export function VistaBuscar({
  q,
  resultados,
  buscador,
  cargando = false,
}: {
  q: string;
  resultados: IglesiaEnLista[];
  /** La app, mientras llegan los resultados. La web los trae ya pintados. */
  cargando?: boolean;
  buscador?: Omit<ComponentProps<typeof BuscadorIglesias>, 'inicial'>;
}) {
  // Si salen varias con el mismo nombre, se avisa: la ciudad es la que manda.
  const nombres = new Map<string, number>();
  for (const r of resultados) {
    const n = r.nombre.toLocaleLowerCase('es');
    nombres.set(n, (nombres.get(n) ?? 0) + 1);
  }
  const repetidas = [...nombres.values()].some((n) => n > 1);

  return (
    <MarcoBienvenida volver="/empezar" titulo="Busca tu iglesia">
      {/* `key` con la búsqueda: al volver con resultados, el campo empieza
          con lo buscado y sin sugerencias abiertas. */}
      <BuscadorIglesias key={q} inicial={q} {...buscador} />

      {cargando && <p className="text-[14px] text-muted-foreground">Buscando…</p>}

      {!cargando && q.length >= 2 && resultados.length > 0 && (
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
              <FilaIglesia key={r.slug} iglesia={r} />
            ))}
          </div>
          <p className="text-[14px] text-muted-foreground">
            ¿No la ves? Prueba con otra palabra del nombre.
          </p>
        </>
      )}

      {!cargando && q.length >= 2 && resultados.length === 0 && (
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
