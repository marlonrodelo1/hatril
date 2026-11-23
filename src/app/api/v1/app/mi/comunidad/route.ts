import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaComunidad } from '@/lib/app-api/miembro';
import { datosDelMuro } from '@/app/mi/comunidad/datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El muro (`/mi/comunidad`): las publicaciones, la portada del día y lo que
 * puede hacer quien mira. La misma consulta que la web (`datosDelMuro`) y la
 * misma guarda. Las fotos llegan firmadas, como en la web.
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  const respuesta: RespuestaComunidad = await datosDelMuro(ctx);
  return respuesta;
});
