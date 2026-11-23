import { z } from 'zod';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaDevocional } from '@/lib/app-api/miembro';
import { devocionalParaLeer, devocionalesAnteriores } from '@/lib/devocionales/consultas';
import { leerVideo } from '@/lib/devocionales/video';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El devocional (`/mi/devocional`): el de hoy, o el de la fecha pedida, y los
 * anteriores. Las mismas consultas y la misma guarda que la página de la web.
 */
const Entrada = z.object({
  d: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
});

export const GET = endpointApp({ guarda: guardaMiembro, entrada: Entrada }, async ({ ctx, entrada }) => {
  const fecha = entrada.d;
  const d = await devocionalParaLeer(ctx, fecha);
  const anteriores = d ? await devocionalesAnteriores(ctx, d.fecha) : [];
  const respuesta: RespuestaDevocional = {
    fecha: fecha ?? null,
    d,
    video: leerVideo(d?.videoUrl),
    anteriores,
  };
  return respuesta;
});
