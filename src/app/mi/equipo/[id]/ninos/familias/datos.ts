import 'server-only';

import { requireMinisterioEnLaApp } from '@/lib/ministerios/en-la-app/guarda';
import { ninosDelMinisterio, solicitudesPendientes } from '@/lib/ninos/consultas';
import { aceptaFamilias } from '@/app/panel/ministerios/[id]/ninos/guarda';

/**
 * Las familias en la app del equipo: aceptar y rechazar peticiones (solo la
 * responsable y el pastor) y la lista de niños con quién puede salir en fotos
 * (todos los maestros). Lo mismo que la pantalla del panel, para quien lleva
 * el ministerio desde el teléfono.
 */
export async function cargar({ id, error, guardado }: { id: string; error?: string; guardado?: string }) {
  const { ctx, ministerio } = await requireMinisterioEnLaApp(id, 'ninos');
  const acepta = aceptaFamilias(ctx, ministerio);
  const [pendientes, ninos] = await Promise.all([
    acepta ? solicitudesPendientes(ctx, id) : Promise.resolve([]),
    ninosDelMinisterio(ctx, id),
  ]);
  return { id, error, guardado, ctx, ministerio, acepta, pendientes, ninos, anio: new Date().getUTCFullYear() };
}
