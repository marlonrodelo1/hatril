import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * El guard de la radio de un ministerio. Las mismas dos puertas que los turnos.
 *
 *   1. `requireGestionMinisterio` — quién. Pastor, quien tenga
 *      `gestionar_ministerios`, o el responsable y los colíderes de ESTE equipo.
 *   2. El módulo encendido — qué. Con la emisora apagada la ruta no existe para
 *      ese ministerio, y entrar por la URL da 404 en vez de una pantalla vacía.
 *
 * Lo que este layout NO cubre son las actions, que no pasan por él: por eso
 * `guardarEmisora` repite las dos comprobaciones.
 */
export default async function EmisoraLayout({
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
  if (!tieneModulo(ministerio.modulos, 'emisora')) notFound();

  return <>{children}</>;
}
