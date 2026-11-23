import { type NextRequest, NextResponse } from 'next/server';

import { getClientIp } from '@/lib/api/rate-limit';
import { ConsultaDetalle, detalle } from '@/lib/lugares/publicas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El sitio elegido de las sugerencias, con sus coordenadas. Para la web; la
 * app tiene `/api/v1/app/lugares/detalle`. Ver `./../sugerencias/route.ts`.
 */
export async function GET(request: NextRequest) {
  const parsed = ConsultaDetalle.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]!.message, detalles: parsed.error.flatten().fieldErrors },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const r = await detalle(parsed.data, getClientIp(request));
  return NextResponse.json(r.ok ? r.datos : { error: r.error }, {
    status: r.ok ? 200 : r.status,
    headers: { 'Cache-Control': 'no-store' },
  });
}
