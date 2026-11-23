import type { Metadata } from 'next';
import { z } from 'zod';

import {
  ciudadesDelDirectorio,
  cultoPrincipal,
  iglesiasDeCiudad,
} from '@/lib/iglesias/directorio';
import { VistaCiudad } from '../_components/vista-ciudad';

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

  return (
    <VistaCiudad
      ciudad={ciudad}
      ciudades={ciudades}
      iglesias={iglesias.map((i) => ({ ...i, principal: cultoPrincipal(i.horarios) }))}
    />
  );
}
