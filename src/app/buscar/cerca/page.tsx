import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { cultoPrincipal, iglesiasConUbicacion } from '@/lib/iglesias/directorio';
import { CercaDeMi } from './_components/cerca-de-mi';

export const metadata: Metadata = { title: 'Iglesias cerca de ti' };

/** Ver `CercaDeMi`: aquí solo se cargan las iglesias que han puesto dónde están. */
export default async function CercaPage() {
  const iglesias = (await iglesiasConUbicacion()).map((i) => ({
    slug: i.slug,
    nombre: i.nombre,
    denominacion: i.denominacion,
    ciudad: i.ciudad,
    pais: i.pais,
    logoUrl: i.logoUrl,
    principal: cultoPrincipal(i.horarios),
    latitud: i.latitud!,
    longitud: i.longitud!,
  }));

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="mx-auto flex w-full max-w-[560px] items-center px-2 pt-2">
        <Link
          href="/empezar"
          aria-label="Volver"
          className="flex size-11 items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <ChevronLeft className="size-5" strokeWidth={1.9} />
        </Link>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-5 pt-2">
        <CercaDeMi iglesias={iglesias} />
      </main>
    </div>
  );
}
