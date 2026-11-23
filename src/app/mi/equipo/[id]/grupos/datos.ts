import 'server-only';

import { sumarDias } from '@/lib/agenda/horarios';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { contarLaRed, gruposDeLaRed, guiasDeLaRed } from '@/lib/grupos/consultas';
import { lunesDe } from '@/lib/grupos/semanas';
import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { SEMANAS_POR_DELANTE } from '@/app/panel/ministerios/[id]/grupos/constantes';

/**
 * La red de células en la app de quien la lleva (`/mi/equipo/[id]/grupos`),
 * con su guarda. Lo usan la página de la web y la API de la app empaquetada.
 *
 * La puerta es `requireMinisterioEnLaApp(id, 'grupos')`, que aplica la
 * estrecha del adaptador (`lib/grupos/en-la-app.ts`): el pastor o quien lidera
 * la red desde dentro. Un líder de célula con rol `miembro` no pasa: lo suyo es
 * su célula, en `./[grupoId]`.
 *
 * Las guías salen como objeto y no como `Map`: esto viaja en JSON a la app.
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'grupos');

  const hoy = hoyEnLaIglesia(ctx.iglesia.timezone);
  const semanas = Array.from({ length: SEMANAS_POR_DELANTE }, (_, i) => sumarDias(lunesDe(hoy), 7 * i));

  const [lista, guias] = await Promise.all([
    gruposDeLaRed(ctx, id, hoy),
    guiasDeLaRed(ctx, id, semanas[0]!, semanas[semanas.length - 1]!),
  ]);

  return {
    id,
    error,
    guardado,
    ctx,
    ministerio,
    hoy,
    semanas,
    lista,
    cuenta: contarLaRed(lista),
    guias: Object.fromEntries(guias),
  };
}
