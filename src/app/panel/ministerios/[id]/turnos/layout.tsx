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
 * Aquí se repiten solo para la navegación. NO protegen nada: en Next 16 la
 * página se ejecuta aunque el layout redirija, y lo que consulta viaja en el
 * payload RSC. Cada página pone las dos con `requireModuloMinisterio(id,
 * 'turnos')`. Ver CLAUDE.md y `npm run test:puertas`.
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
