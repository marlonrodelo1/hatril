import { endpointApp, errorApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaReunion } from '@/lib/app-api/miembro';
import { reunionParaMiembro } from '@/lib/agenda/ensayos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La ficha de un ensayo del equipo (`/mi/agenda/reunion/[id]`). La misma
 * consulta que la web: 404 si la reunión no es de un equipo suyo.
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx, params }) => {
  if (!UUID.test(params.id ?? '')) return errorApp('Esto no existe.', 404);
  const reunion = await reunionParaMiembro(ctx, params.id!);
  if (!reunion) return errorApp('Esto no existe.', 404);
  const respuesta: RespuestaReunion = { reunion };
  return respuesta;
});
