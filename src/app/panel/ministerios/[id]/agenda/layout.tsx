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
 * Aquí se repiten solo para la navegación. NO protegen nada: en Next 16 la
 * página se ejecuta aunque el layout redirija, y lo que consulta viaja en el
 * payload RSC. Cada página pone las dos con `requireModuloMinisterio(id,
 * 'agenda')`. Ver CLAUDE.md y `npm run test:puertas`.
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
