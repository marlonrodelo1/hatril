import { z } from 'zod';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaBiblia } from '@/lib/app-api/miembro';
import { libroPorSlug } from '@/lib/biblia/libros';
import { cargarCapitulo } from '@/lib/biblia/texto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Un capítulo de la Biblia (`/mi/biblia?libro=&cap=`). El índice y los libros
 * van con el código de la app (`LIBROS`); aquí solo se pide el texto. La misma
 * guarda que la web: la Biblia es una pestaña de la app del miembro.
 */
const Entrada = z.object({ libro: z.string().max(40).optional(), cap: z.string().max(4).optional() });

export const GET = endpointApp({ guarda: guardaMiembro, entrada: Entrada }, async ({ entrada }) => {
  const libro = libroPorSlug(entrada.libro);
  const numero = Number(entrada.cap);
  const respuesta: RespuestaBiblia = {
    capitulo: libro && Number.isInteger(numero) ? await cargarCapitulo(libro, numero) : null,
  };
  return respuesta;
});
