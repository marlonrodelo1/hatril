import { z } from 'zod';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaDenunciaEnviada } from '@/lib/app-api/miembro';
import { misBloqueos, nombreDeMiembro } from '@/lib/comunidad/moderacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «Denuncia enviada» (`/mi/comunidad/denuncia-enviada?autor=`): el nombre de
 * quien escribió lo denunciado, para ofrecer bloquearle, y si ya lo está. La
 * misma consulta que la web; el nombre sale con la RLS de quien pregunta.
 */
const Entrada = z.object({ autor: z.string().optional() });

export const GET = endpointApp({ guarda: guardaMiembro, entrada: Entrada }, async ({ ctx, entrada }) => {
  const autorId = z.uuid().safeParse(entrada.autor).success ? entrada.autor! : null;
  const [nombre, bloqueos] = await Promise.all([
    autorId ? nombreDeMiembro(ctx, autorId) : Promise.resolve(null),
    misBloqueos(ctx),
  ]);
  const respuesta: RespuestaDenunciaEnviada = {
    autorId,
    nombre,
    yaBloqueado: bloqueos.some((b) => b.miembroId === autorId),
  };
  return respuesta;
});
