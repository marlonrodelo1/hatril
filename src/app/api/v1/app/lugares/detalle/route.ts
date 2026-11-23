import { endpointApp, errorApp, publica } from '@/lib/api/app';
import { getClientIp } from '@/lib/api/rate-limit';
import { ConsultaDetalle, detalle } from '@/lib/lugares/publicas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** El sitio elegido, con sus coordenadas. Ver `../sugerencias/route.ts`. */
export const GET = endpointApp(
  { guarda: publica, entrada: ConsultaDetalle },
  async ({ entrada, request }) => {
    const r = await detalle(entrada, getClientIp(request));
    return r.ok ? r.datos : errorApp(r.error, r.status);
  },
);
