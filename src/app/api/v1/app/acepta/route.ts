import { endpointApp } from '@/lib/api/app';
import type { RespuestaAcepta } from '@/lib/app-api/miembro';
import { requireIglesia } from '@/lib/auth/guard-panel';
import { estadoConsentimiento } from '@/lib/rgpd/consultas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Lo que necesita `/acepta`: si es la primera vez o una versión nueva de la
 * política. La guarda es tener iglesia y nada más, como la página de la web:
 * es justo la pantalla de quien NO tiene el consentimiento al día.
 */
export const GET = endpointApp({ guarda: requireIglesia }, async ({ ctx }) => {
  const respuesta: RespuestaAcepta = {
    iglesiaNombre: ctx.iglesia.nombre,
    primeraVez: (await estadoConsentimiento(ctx)).versionAceptada === null,
  };
  return respuesta;
});
