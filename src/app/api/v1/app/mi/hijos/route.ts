import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaHijos } from '@/lib/app-api/hijos';
import { datosDeMisHijos } from '@/lib/ninos/familia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «Mis hijos» (`/mi/hijos`): los ministerios con tablón de la iglesia, y los
 * hijos y peticiones de quien pregunta. Solo lo suyo, también si además lleva
 * el ministerio (`lib/ninos/familia.ts`).
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  const respuesta: RespuestaHijos = await datosDeMisHijos(ctx);
  return respuesta;
});
