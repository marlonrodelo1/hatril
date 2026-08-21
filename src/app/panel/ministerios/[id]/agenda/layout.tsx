import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * El guard de la agenda de un ministerio.
 *
 * DOS PUERTAS, Y LAS DOS EN EL LAYOUT
 * -----------------------------------
 *   1. `requireGestionMinisterio` — quién. Pastor, quien tenga
 *      `gestionar_ministerios`, o el responsable y los colíderes de ESTE equipo.
 *      Rebota a `/panel/ministerios?error=`.
 *   2. El módulo encendido — qué. Un ministerio con la agenda apagada no tiene
 *      esta pantalla, y entrar por la URL da 404 en vez de una sección vacía.
 *
 * La segunda va aquí y no en cada página por lo de siempre: `nueva`,
 * `[reunionId]` y `[reunionId]/editar` cuelgan de este layout, y comprobarlo
 * página a página es donde se quedan los huecos.
 *
 * `notFound()` y no un rebote con mensaje: quien llega aquí con el módulo
 * apagado no es alguien a quien le falte un permiso —lo tiene—, es una ruta que
 * para ese ministerio no existe.
 */
export default async function AgendaLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const ctx = await requireGestionMinisterio(id);

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();
  if (!tieneModulo(ministerio.modulos, 'agenda')) notFound();

  return <>{children}</>;
}
