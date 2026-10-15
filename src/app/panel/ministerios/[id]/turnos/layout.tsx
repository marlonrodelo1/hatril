import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * El guard de los turnos de un ministerio. Las mismas dos puertas que la agenda.
 *
 *   1. `requireGestionMinisterio` — quién. Pastor, quien tenga
 *      `gestionar_ministerios`, o el responsable y los colíderes de ESTE equipo.
 *   2. El módulo encendido — qué. Con los turnos apagados la ruta no existe para
 *      ese ministerio, y entrar por la URL da 404 en vez de una sección vacía.
 *
 * Aquí y no en cada página: `planificar` y `[turnoId]` cuelgan de este layout,
 * y comprobarlo página a página es donde se quedan los huecos.
 *
 * Lo que este layout NO cubre son las actions: un layout no se vuelve a
 * ejecutar al navegar, y una server action no pasa por él. Cada action lleva su
 * `requireGestionMinisterioAccion`.
 */
export default async function TurnosLayout({
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
  if (!tieneModulo(ministerio.modulos, 'turnos')) notFound();

  return <>{children}</>;
}
