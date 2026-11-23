import { endpointApp, errorApp, publica } from '@/lib/api/app';
import { getClientIp } from '@/lib/api/rate-limit';
import { ConsultaSugerencias, sugerencias } from '@/lib/lugares/publicas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sugerencias de direcciones para «cerca de una dirección» en la app. Lo mismo
 * que `/api/v1/lugares/sugerencias` de la web (`lib/lugares/publicas.ts`): el
 * teléfono pregunta a hatril.com y hatril.com a Google, así que Google no ve
 * al teléfono.
 */
export const GET = endpointApp(
  { guarda: publica, entrada: ConsultaSugerencias },
  async ({ entrada, request }) => {
    const r = await sugerencias(entrada, getClientIp(request));
    return r.ok ? r.datos : errorApp(r.error, r.status);
  },
);
