import type { Metadata } from 'next';

import { VistaCancion } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Canción' };

/**
 * Una canción del repertorio: dónde escucharla, cuándo ha sonado y sus datos.
 *
 * Arriba lo que se viene a mirar —los enlaces y la historia—, y el formulario
 * debajo: se abre esta pantalla más para ensayar que para corregir. Archivar
 * y borrar, al final; borrar, en su tarjeta roja.
 */
export default async function CancionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; cancionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, cancionId } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, cancionId, error, guardado });
  return <VistaCancion {...datos} />;
}
