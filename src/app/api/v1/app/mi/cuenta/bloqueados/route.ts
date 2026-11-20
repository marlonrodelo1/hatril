import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaBloqueados } from '@/lib/app-api/miembro';
import { misBloqueos } from '@/lib/comunidad/moderacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** A quién ha bloqueado esta persona (`/mi/cuenta/bloqueados`). Solo lo suyo. */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  const respuesta: RespuestaBloqueados = {
    bloqueos: await misBloqueos(ctx),
    timezone: ctx.iglesia.timezone,
  };
  return respuesta;
});
