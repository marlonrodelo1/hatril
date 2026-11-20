import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';

/**
 * Lo que consulta esta pantalla de `/mi/equipo`, con su guarda. Lo usan la
 * página de la web y la API de la app empaquetada (`/api/v1/app/...`), para
 * que las dos pidan y corten exactamente igual. Salió de `./page.tsx` el
 * 20-nov, sin cambiar nada.
 */
export async function cargar({ id, error }: { id: string; error?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'agenda');

  return { id, error, ctx, ministerio };
}
