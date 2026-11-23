import { conSesion, endpointApp, sinContenido } from '@/lib/api/app';
import { EsquemaOlvidarPush, EsquemaTelefonoPush } from '@/lib/app-api/push';
import { apuntarTelefono, olvidarTelefono } from '@/lib/push/telefonos';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El teléfono de esta cuenta para las push: apuntarlo al dar permiso, y
 * olvidarlo al cerrar sesión. Es `registrarDispositivo` y la parte de `salir()`
 * que leía la cookie `hatril_push`; en la app el token lo guarda el propio
 * teléfono y lo manda aquí.
 */
export const POST = endpointApp(
  { guarda: conSesion, entrada: EsquemaTelefonoPush },
  async ({ ctx: user, entrada }) => {
    await apuntarTelefono(user.id, entrada.token, entrada.plataforma);
    return sinContenido();
  },
);

export const DELETE = endpointApp(
  { guarda: conSesion, entrada: EsquemaOlvidarPush },
  async ({ ctx: user, entrada }) => {
    await olvidarTelefono(user.id, entrada.token);
    return sinContenido();
  },
);
