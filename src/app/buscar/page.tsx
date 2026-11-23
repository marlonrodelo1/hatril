import type { Metadata } from 'next';
import { z } from 'zod';

import { buscarIglesias, cultoPrincipal } from '@/lib/iglesias/directorio';
import { VistaBuscar } from './_components/vista-buscar';

export const metadata: Metadata = { title: 'Busca tu iglesia' };

/**
 * «Ya pertenezco a una iglesia»: buscarla por su nombre, con sugerencias
 * mientras se escribe (`_components/buscador.tsx`).
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

  return (
    <VistaBuscar
      q={q}
      resultados={resultados.map((r) => ({ ...r, principal: cultoPrincipal(r.horarios) }))}
    />
  );
}
