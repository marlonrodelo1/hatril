import { endpointApp, errorApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaTurno } from '@/lib/app-api/miembro';
import { datosDelTurno } from '@/app/mi/agenda/turno/[id]/datos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * La ficha de un turno del miembro (`/mi/agenda/turno/[id]`). La misma
 * consulta que la web (`datosDelTurno`): 404 si el turno no es de su equipo,
 * igual que el `notFound()` de la página.
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx, params }) => {
  if (!UUID.test(params.id ?? '')) return errorApp('Esto no existe.', 404);
  const datos = await datosDelTurno(ctx, params.id!);
  if (!datos) return errorApp('Esto no existe.', 404);
  const respuesta: RespuestaTurno = datos;
  return respuesta;
});
