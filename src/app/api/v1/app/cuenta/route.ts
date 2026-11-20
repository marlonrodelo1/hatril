import { endpointApp, errorApp, publica } from '@/lib/api/app';
import { getClientIp } from '@/lib/api/rate-limit';
import { EsquemaCuentaPersonal } from '@/lib/app-api/solicitud';
import { crearCuentaPersonal } from '@/lib/solicitudes/alta';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Crear la cuenta personal desde la app: `/crear-cuenta` y el paso de la
 * solicitud de quien todavía no tiene cuenta.
 *
 * PÚBLICA, PORQUE QUIEN LA USA NO TIENE SESIÓN
 * --------------------------------------------
 * La puerta es la de la web: el límite de diez cuentas al día por conexión y
 * la regla de la contraseña, las dos en `crearCuentaPersonal`. No devuelve la
 * sesión: la abre el teléfono con el correo y la contraseña que acaba de
 * escribir, contra Supabase, como cualquier acceso.
 */
export const POST = endpointApp(
  { guarda: publica, entrada: EsquemaCuentaPersonal },
  async ({ entrada, request }) => {
    const r = await crearCuentaPersonal(entrada, getClientIp(request));
    if (!r.ok) return errorApp(r.error, r.yaExiste ? 409 : 400);
    return Response.json({ creada: true }, { status: 201 });
  },
);
