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
 * Van en el layout y no en cada página porque debajo cuelga `[miembroId]`, que
 * es la pantalla donde se lee por qué una persona concreta dejó de venir. Es
 * exactamente el sitio donde el proyecto anterior dejó el hueco: la lista
 * guardada y el detalle abierto.
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
