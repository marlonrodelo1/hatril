import { conSesion, endpointApp } from '@/lib/api/app';
import type { RespuestaCampana } from '@/lib/app-api/miembro';
import { paraLaCampana } from '@/lib/notificaciones/campana';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La campana de la cabecera: los últimos avisos de esta cuenta, ya escritos.
 *
 * Lo mismo que pide `CabeceraMiembro` en la web, y con la misma guarda que
 * `/mi/avisos`: solo sesión. A quien le rechazan la solicitud se le borra la
 * membresía, y el aviso que se lo cuenta tiene que seguir llegándole. Los
 * textos se componen aquí (`paraLaCampana`) por lo mismo que en la web: el
 * teléfono no necesita el catálogo entero.
 */
export const GET = endpointApp({ guarda: conSesion }, async ({ ctx: user }) => {
  const avisos = await listarNotificaciones(user.id);
  const respuesta: RespuestaCampana = {
    avisos: paraLaCampana(avisos),
    sinLeer: avisos.filter((a) => !a.leida).length,
  };
  return respuesta;
});
