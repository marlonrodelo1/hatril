import { NextResponse } from 'next/server';

import { requireApiToken } from '@/lib/api/auth';
import { limpiarNinos } from '@/lib/ninos/caducidad';

/**
 * El borrado al año del ministerio de Niños, y su aviso de 30 días.
 *
 * Lo llama un cron una vez al día con `Authorization: Bearer
 * $INTERNAL_API_TOKEN`, como el de las bajas de cuenta. Sin ese cron, «se
 * borran al año» —que dicen la pantalla del drive, el tablón y /privacidad— es
 * una promesa que nadie cumple. Qué hace y en qué orden, en
 * `lib/ninos/caducidad.ts`.
 *
 * Solo POST: un GET lo dispara cualquier cosa que siga enlaces, y esto borra.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const fallo = requireApiToken(req);
  if (fallo) return fallo;

  const resultado = await limpiarNinos();
  return NextResponse.json(resultado, {
    status: resultado.errores.length > 0 ? 207 : 200,
  });
}
