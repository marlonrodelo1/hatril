import { conSesion, endpointApp } from '@/lib/api/app';
import type { RespuestaAvisos } from '@/lib/app-api/miembro';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { listarNotificaciones } from '@/lib/notificaciones/consultas';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { ZONA_SIN_IGLESIA } from '@/app/mi/avisos/_components/vista-avisos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Los avisos de la cuenta (`/mi/avisos`). Las mismas puertas que la página de
 * la web: solo sesión, y el consentimiento al día solo a quien tiene iglesia.
 * A quien le rechazan la solicitud se le borra la membresía, y el aviso que se
 * lo cuenta tiene que seguir llegándole.
 */
export const GET = endpointApp({ guarda: conSesion }, async ({ ctx: user }) => {
  const ctx = await getCurrentUserContext();
  if (ctx) await exigirConsentimientoAlDia(ctx);
  const respuesta: RespuestaAvisos = {
    avisos: await listarNotificaciones(user.id),
    zona: ctx?.iglesia.timezone ?? ZONA_SIN_IGLESIA,
  };
  return respuesta;
});
