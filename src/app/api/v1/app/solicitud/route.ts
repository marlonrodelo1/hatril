import { conSesion, endpointApp, errorApp, sinContenido } from '@/lib/api/app';
import { EsquemaSolicitud, type RespuestaSolicitud } from '@/lib/app-api/solicitud';
import { cancelarSolicitudDe, registrarSolicitud } from '@/lib/solicitudes/alta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pedir entrar en una iglesia, y cancelarlo, desde la app.
 *
 * Las mismas funciones que la web (`src/lib/solicitudes/alta.ts`), con la
 * misma guarda: tener sesión. Lo demás —que la iglesia exista y acepte, una
 * sola iglesia por persona— lo comprueban ellas. Y la cuenta sale de la
 * sesión, nunca del cuerpo de la petición.
 */
export const POST = endpointApp(
  { guarda: conSesion, entrada: EsquemaSolicitud },
  async ({ ctx: user, entrada }) => {
    const r = await registrarSolicitud(user, entrada);
    if (!r.ok) return errorApp(r.error, r.ir === '/buscar' ? 404 : 409, r.ir);
    const respuesta: RespuestaSolicitud = { resultado: r.resultado };
    return respuesta;
  },
);

/** Solo lo suyo y solo lo pendiente: la cuenta de la sesión, nada del cuerpo. */
export const DELETE = endpointApp({ guarda: conSesion }, async ({ ctx: user }) => {
  await cancelarSolicitudDe(user.id);
  return sinContenido();
});
