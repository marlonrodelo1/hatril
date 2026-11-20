import { z } from 'zod';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaAgenda } from '@/lib/app-api/miembro';
import { datosDeLaAgenda } from '@/app/mi/agenda/datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La agenda (`/mi/agenda`): la vista pedida (`v`, `d`) y los turnos por
 * contestar. La misma consulta que la página de la web (`datosDeLaAgenda`) y
 * la misma guarda.
 */
const Entrada = z.object({
  v: z.string().max(10).optional(),
  d: z.string().max(10).optional(),
});

export const GET = endpointApp({ guarda: guardaMiembro, entrada: Entrada }, async ({ ctx, entrada }) => {
  const respuesta: RespuestaAgenda = await datosDeLaAgenda(ctx, entrada.v, entrada.d);
  return respuesta;
});
