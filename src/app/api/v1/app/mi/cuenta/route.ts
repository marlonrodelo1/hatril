import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaCuenta } from '@/lib/app-api/miembro';
import { datosDeMiCuenta } from '@/app/mi/cuenta/datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Mi cuenta (`/mi/cuenta`): la misma consulta que la web y la misma guarda. */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  const respuesta: RespuestaCuenta = await datosDeMiCuenta(ctx, ctx.user);
  return respuesta;
});
