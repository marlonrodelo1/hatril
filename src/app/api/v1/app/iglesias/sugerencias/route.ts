import { z } from 'zod';

import { endpointApp, publica } from '@/lib/api/app';
import type { RespuestaSugerencias } from '@/lib/app-api/iglesias';
import { sugerirIglesias } from '@/lib/iglesias/directorio';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Las sugerencias del buscador mientras se escribe. Es
 * `/api/v1/iglesias/sugerencias` con la puerta de la app (CORS de la app y el
 * mismo formato de error); la consulta es la misma, como `anon`.
 */
const Entrada = z.object({ q: z.string().trim().min(2, 'Escribe al menos dos letras.').max(80) });

export const GET = endpointApp({ guarda: publica, entrada: Entrada }, async ({ entrada }) => {
  const respuesta: RespuestaSugerencias = { sugerencias: await sugerirIglesias(entrada.q) };
  return respuesta;
});
