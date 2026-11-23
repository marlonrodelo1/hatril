import { NextResponse } from 'next/server';

import { requireApiToken } from '@/lib/api/auth';
import { completarBajasVencidas } from '@/lib/cuenta/baja';

/**
 * Completa los borrados de cuenta que ya han cumplido sus treinta días.
 *
 * Lo llama un cron una vez al día con `Authorization: Bearer
 * $INTERNAL_API_TOKEN`. Sin ese cron, «a los treinta días borramos tu cuenta»
 * es una promesa que nadie cumple: está apuntado en ESTADO.md como pendiente
 * de configurar en el servidor.
 *
 * Solo POST: un GET lo dispara cualquier cosa que siga enlaces, y esto borra.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const fallo = requireApiToken(req);
  if (fallo) return fallo;

  const resultado = await completarBajasVencidas();
  return NextResponse.json(resultado, {
    status: resultado.fallidas > 0 ? 207 : 200,
  });
}
