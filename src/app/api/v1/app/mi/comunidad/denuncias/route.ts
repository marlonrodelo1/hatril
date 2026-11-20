import { redirect } from 'next/navigation';

import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaDenuncias } from '@/lib/app-api/miembro';
import { puedeModerarComunidad } from '@/lib/auth/permisos';
import { denunciasPendientes } from '@/lib/comunidad/moderacion';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La cola de denuncias (`/mi/comunidad/denuncias`), solo para quien modera.
 * Quien no, recibe el mismo corte que en la web: de vuelta al muro (403 con
 * `ir`), sin ver nada de la cola.
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  if (!puedeModerarComunidad(ctx)) redirect('/mi/comunidad');
  const respuesta: RespuestaDenuncias = { cola: await denunciasPendientes(ctx) };
  return respuesta;
});
