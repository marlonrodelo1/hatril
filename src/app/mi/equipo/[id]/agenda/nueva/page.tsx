import type { Metadata } from 'next';

import { VistaReunionNueva } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Apuntar en la agenda' };

/**
 * Apuntar un ensayo, una reunión o una salida del equipo.
 *
 * Existe como pantalla propia, y no plegada dentro de la lista, porque la
 * action del panel vuelve aquí con `?error=` cuando falta un campo: es la ruta
 * gemela de `/panel/ministerios/[id]/agenda/nueva` (ver `en-la-app/rutas.ts`).
 */
export default async function NuevaReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, error });
  return <VistaReunionNueva {...datos} />;
}
