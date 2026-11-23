import { endpointApp, guardaMiembro } from '@/lib/api/app';
import type { RespuestaTablonHijos } from '@/lib/app-api/hijos';
import { tablonDeLaFamilia } from '@/lib/ninos/familia';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * El tablón de la familia (`/mi/hijos/tablon`): lo publicado en los
 * ministerios de sus hijos desde que la aceptaron, con las fotos y vídeos
 * firmados diez minutos. A quien no tiene hijos aceptados, una lista vacía.
 */
export const GET = endpointApp({ guarda: guardaMiembro }, async ({ ctx }) => {
  const respuesta: RespuestaTablonHijos = { publicaciones: await tablonDeLaFamilia(ctx) };
  return respuesta;
});
