import { NextResponse } from 'next/server';

import { requireApiToken } from '@/lib/api/auth';
import { refrescarCoordenadas } from '@/lib/lugares/refresco';

/**
 * Las coordenadas que vinieron de Google, refrescadas antes de los 30 días que
 * dejan guardarlas, y borradas si no se puede. Qué hace y por qué, en
 * `lib/lugares/refresco.ts`.
 *
 * Lo llama un cron una vez al día con `Authorization: Bearer
 * $INTERNAL_API_TOKEN`, como el de las bajas y el de Niños. Sin él, a los 30
 * días las iglesias con dirección de Google dejan de salir en «cerca» (el
 * filtro de `iglesiasConUbicacion`), que es lo seguro; con él, siguen.
 *
 * Solo POST: un GET lo dispara cualquier cosa que siga enlaces, y esto borra.
 */
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const fallo = requireApiToken(req);
  if (fallo) return fallo;

  const resultado = await refrescarCoordenadas();
  return NextResponse.json(resultado, {
    status: resultado.errores.length > 0 ? 207 : 200,
  });
}
