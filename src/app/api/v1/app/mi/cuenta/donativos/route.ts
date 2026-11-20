import { z } from 'zod';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaDonativos } from '@/lib/app-api/miembro';
import { estadoDeDar, misDonativos } from '@/lib/donativos/consultas';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «Lo que he dado» (`/mi/cuenta/donativos?anio=`): lo que esta persona ha dado
 * a su iglesia con tarjeta. Solo lo suyo: `misDonativos` filtra por su ficha.
 */
const Entrada = z.object({ anio: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined) });

export const GET = endpointApp({ guarda: guardaMiembro, entrada: Entrada }, async ({ ctx, entrada }) => {
  const [mios, dar] = await Promise.all([misDonativos(ctx, entrada.anio), estadoDeDar(ctx.iglesia.id)]);
  const respuesta: RespuestaDonativos = {
    iglesia: { slug: ctx.iglesia.slug, nombre: ctx.iglesia.nombre },
    mios,
    dar,
    actual: Number(hoyEnLaIglesia(ctx.iglesia.timezone).slice(0, 4)),
  };
  return respuesta;
});
