import { endpointApp, publica } from '@/lib/api/app';
import type { RespuestaCerca } from '@/lib/app-api/iglesias';
import { cultoPrincipal, iglesiasConUbicacion } from '@/lib/iglesias/directorio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las iglesias del directorio que han puesto dónde están, para «Cerca de mí».
 *
 * La distancia se calcula en el teléfono (`CercaDeMi`): la ubicación de quien
 * busca no sale de él, ni la dirección que escriba, que se geocodifica contra
 * OpenStreetMap desde el propio teléfono. Es lo mismo que hace `/buscar/cerca`.
 */
export const GET = endpointApp({ guarda: publica }, async () => {
  const respuesta: RespuestaCerca = {
    iglesias: (await iglesiasConUbicacion()).map((i) => ({
      slug: i.slug,
      nombre: i.nombre,
      denominacion: i.denominacion,
      ciudad: i.ciudad,
      pais: i.pais,
      logoUrl: i.logoUrl,
      principal: cultoPrincipal(i.horarios),
      latitud: i.latitud!,
      longitud: i.longitud!,
    })),
  };
  return respuesta;
});
