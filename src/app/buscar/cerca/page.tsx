import Link from 'next/link';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { cultoPrincipal, iglesiasConUbicacion } from '@/lib/iglesias/directorio';
import { CercaDeMi } from './_components/cerca-de-mi';

export const metadata: Metadata = { title: 'Iglesias cerca de ti' };

/*
 * EN CADA VISITA, Y NO AL COMPILAR
 *
 * Sin nada dinámico dentro (ni sesión, ni parámetros), Next la prerenderizaba
 * en el build, y eso consulta la base. Dentro del contenedor de Docker no
 * existe `DATABASE_URL` al compilar —es una variable de ejecución— y el build
 * entero se caía con «Export encountered an error on /buscar/cerca». Desde
 * `a8af2d3` hasta el 17-nov ningún push llegó a desplegarse por esto, y en
 * local no se veía porque ahí sí está el `.env.local`.
 *
 * Además es lo correcto: una iglesia que pone su ubicación tiene que salir ya,
 * no en la siguiente compilación. La consulta es pequeña (ver
 * `iglesiasConUbicacion`).
 */
export const dynamic = 'force-dynamic';

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
