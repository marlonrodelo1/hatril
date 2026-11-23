import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { iniciales } from '@/lib/format/iniciales';
import type { HorarioSemanal } from '@/lib/db/schema';

/**
 * Una iglesia en una lista de la bienvenida: buscar por nombre, por ciudad y
 * cerca de mí.
 *
 * La ciudad va siempre, y con el país: «Iglesia Betania» hay muchas, y es lo
 * único que las distingue en una lista. Sin hooks a propósito, para que la use
 * igual la lista de servidor (nombre, ciudad) que la de cliente (cerca de mí).
 */
export type IglesiaEnLista = {
  slug: string;
  nombre: string;
  denominacion: string | null;
  ciudad: string | null;
  pais: string;
  logoUrl: string | null;
  principal: HorarioSemanal | null;
  /** En kilómetros, solo en «cerca de mí». */
  distancia?: number;
};

const PAISES: Record<string, string> = { CO: 'Colombia', ES: 'España' };

export function nombrePais(codigo: string): string {
  return PAISES[codigo] ?? codigo;
}

export function formatearDistancia(km: number): string {
  return km < 10
    ? `${km.toLocaleString('es', { maximumFractionDigits: 1 })} km`
    : `${Math.round(km)} km`;
}

export function FilaIglesia({ iglesia: i }: { iglesia: IglesiaEnLista }) {
  const lugar = [i.ciudad, nombrePais(i.pais)].filter(Boolean).join(' · ');

  return (
    <Link
      href={`/iglesia/${i.slug}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3.5 text-foreground no-underline outline-none last:border-b-0 hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
    >
      {i.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={i.logoUrl}
          alt=""
          className="size-11 flex-none rounded-xl border border-border bg-surface object-cover"
        />
      ) : (
        <span className="flex size-11 flex-none items-center justify-center rounded-xl bg-accent text-[14px] font-bold text-accent-foreground">
          {iniciales(i.nombre)}
        </span>
      )}

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline gap-2">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold tracking-[-0.015em]">
            {i.nombre}
          </span>
          {i.distancia !== undefined && (
            <span className="flex-none text-[13px] font-semibold text-muted-foreground">
              {formatearDistancia(i.distancia)}
            </span>
          )}
        </span>
        <span className="truncate text-[13.5px] text-muted-foreground">
          {[i.denominacion, lugar].filter(Boolean).join(' · ')}
        </span>
        {i.principal && (
          <span className="truncate text-[13px] text-muted-foreground">
            {i.principal.nombre}: {i.principal.dia.toLowerCase()} {i.principal.hora}
          </span>
        )}
      </span>

      <ChevronRight className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
    </Link>
  );
}

/** El marco de cada pantalla de la bienvenida: volver, título y contenido. */
export function MarcoBienvenida({
  volver,
  titulo,
  children,
}: {
  volver: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="mx-auto flex w-full max-w-[560px] items-center gap-2 px-2 pt-2">
        <Link
          href={volver}
          aria-label="Volver"
          className="flex size-11 items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <ChevronRight className="size-5 rotate-180" strokeWidth={1.9} />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 px-5 pt-2">
        <h1 className="text-balance text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
          {titulo}
        </h1>
        {children}
      </main>
    </div>
  );
}
