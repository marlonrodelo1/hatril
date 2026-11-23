import { type NextRequest, NextResponse } from 'next/server';

import { getClientIp } from '@/lib/api/rate-limit';
import { ConsultaSugerencias, sugerencias } from '@/lib/lugares/publicas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Sugerencias de direcciones mientras se escribe, para la web: «cerca de una
 * dirección» y la dirección de Ajustes. La app tiene la suya en
 * `/api/v1/app/lugares/sugerencias`; las dos son `lib/lugares/publicas.ts`.
 *
 * Pública, como `/buscar/cerca`, y con freno por IP. `no-store`: lo que se
 * escribe es de quien lo escribe, no se guarda en ninguna caché por el medio.
 */
export async function GET(request: NextRequest) {
  const parsed = ConsultaSugerencias.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]!.message, detalles: parsed.error.flatten().fieldErrors },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const r = await sugerencias(parsed.data, getClientIp(request));
  return NextResponse.json(r.ok ? r.datos : { error: r.error }, {
    status: r.ok ? 200 : r.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
