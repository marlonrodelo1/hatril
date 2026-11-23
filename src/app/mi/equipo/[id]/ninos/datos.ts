import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { hoyEnLaIglesia } from '@/lib/fecha/hoy';
import { publicacionesDelTablon, solicitudesPendientes } from '@/lib/ninos/consultas';
import { aceptaFamilias } from '@/app/panel/ministerios/[id]/ninos/guarda';

/**
 * El tablón de Niños en la app del equipo (`/mi/equipo/[id]/ninos`), con su
 * guarda. Lo usan la página de la web y la API de la app empaquetada, para
 * que las dos pidan y corten igual.
 *
 * La puerta es la del adaptador (`lib/ninos/en-la-app.ts`): el pastor o quien
 * lleva ESTE ministerio, la responsable y los colíderes (los maestros).
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'ninos');

  const acepta = aceptaFamilias(ctx, ministerio);
  const [publicaciones, pendientes] = await Promise.all([
    publicacionesDelTablon(ctx, id),
    acepta ? solicitudesPendientes(ctx, id) : Promise.resolve([]),
  ]);

  return {
    id,
    error,
    guardado,
    ctx,
    ministerio,
    hoy: hoyEnLaIglesia(ctx.iglesia.timezone),
    familiasEsperando: pendientes.length,
    publicaciones: publicaciones.map((p) => ({
      id: p.id,
      fecha: p.fecha,
      texto: p.texto,
      publicada: p.publicadaAt !== null,
      archivos: p.archivos.length,
    })),
  };
}
