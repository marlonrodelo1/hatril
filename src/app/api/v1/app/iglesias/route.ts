import { z } from 'zod';

import { endpointApp, publica } from '@/lib/api/app';
import type { RespuestaBuscar } from '@/lib/app-api/iglesias';
import { buscarIglesias, cultoPrincipal, iglesiasDeCiudad } from '@/lib/iglesias/directorio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Buscar iglesias por nombre (`q`) o por ciudad (`ciudad`): lo que pintan
 * `/buscar` y `/buscar/ciudad` en la web, con las mismas consultas.
 *
 * PÚBLICA, COMO EN LA WEB
 * -----------------------
 * Las consultas van como `anon` (`withAnon`): la policy solo deja salir las
 * iglesias que están en el directorio, y los grants por columna, solo lo del
 * directorio. Es lo que ve cualquiera sin sesión.
 */
const Entrada = z.object({
  q: z.string().trim().max(80).optional(),
  ciudad: z.string().trim().max(80).optional(),
});

export const GET = endpointApp({ guarda: publica, entrada: Entrada }, async ({ entrada }) => {
  const filas =
    entrada.ciudad && entrada.ciudad.length >= 2
      ? await iglesiasDeCiudad(entrada.ciudad)
      : entrada.q && entrada.q.length >= 2
        ? await buscarIglesias(entrada.q)
        : [];

  const respuesta: RespuestaBuscar = {
    iglesias: filas.map((i) => ({
      slug: i.slug,
      nombre: i.nombre,
      denominacion: i.denominacion,
      ciudad: i.ciudad,
      pais: i.pais,
      logoUrl: i.logoUrl,
      principal: cultoPrincipal(i.horarios),
    })),
  };
  return respuesta;
});
