import { redirect } from 'next/navigation';

import { conSesion, endpointApp } from '@/lib/api/app';
import type { RespuestaBorrar } from '@/lib/app-api/miembro';
import {
  bajaPendiente,
  fechaDeBorradoSiSePideHoy,
  porQueNoSePuedeBorrar,
  turnosPorVenir,
} from '@/lib/cuenta/baja';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «Borrar mi cuenta» (`/mi/cuenta/borrar`). Como en la web, basta la sesión:
 * Apple y Google piden poder borrar toda cuenta que se pueda crear, también la
 * que nunca llegó a entrar en una iglesia. Con la baja ya pedida, al aviso de
 * cuándo se borra (403 con `ir`).
 */
export const GET = endpointApp({ guarda: conSesion }, async ({ ctx: user }) => {
  if (await bajaPendiente(user.id)) redirect('/cuenta-en-baja');
  const [impedimento, turnos] = await Promise.all([porQueNoSePuedeBorrar(user.id), turnosPorVenir(user.id)]);
  const respuesta: RespuestaBorrar = {
    impedimento,
    turnos,
    dia: new Intl.DateTimeFormat('es', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(
      fechaDeBorradoSiSePideHoy(),
    ),
  };
  return respuesta;
});
