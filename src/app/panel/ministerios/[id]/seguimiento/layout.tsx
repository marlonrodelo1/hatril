import { notFound } from 'next/navigation';

import {
  requireGestionMinisterio,
  requirePermiso,
} from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * Tres puertas, y las tres aquí.
 *
 *   1. `ver_seguimiento` — el permiso más pesado del catálogo. Sin él no se
 *      entra aunque se lleve el ministerio.
 *   2. `requireGestionMinisterio` — y ser responsable o colíder de ESTE equipo.
 *      Tener el permiso no abre el seguimiento de todos los ministerios.
 *   3. El módulo encendido — si el equipo no hace seguimiento, la ruta no existe.
 *
 * Aquí se repiten solo para la navegación. NO protegen nada: en Next 16 la
 * página se ejecuta aunque el layout redirija, y lo que consulta viaja en el
 * payload RSC. Fue justo esta sección: un miembro raso pidiéndola con `RSC: 1`
 * recibía la lista entera con los teléfonos. Cada página pone las tres con
 * `requireModuloMinisterio(id, 'seguimiento', { permiso: 'ver_seguimiento' })`.
 * Ver CLAUDE.md y `npm run test:puertas`.
 */
export default async function SeguimientoLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;

  await requirePermiso('ver_seguimiento');
  const ctx = await requireGestionMinisterio(id);

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();
  if (!tieneModulo(ministerio.modulos, 'seguimiento')) notFound();

  return <>{children}</>;
}
