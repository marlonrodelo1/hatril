import type { Metadata } from 'next';

import { VistaRepertorio } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Repertorio' };

/**
 * Las canciones del equipo, en la app.
 *
 * La lista del domingo NO se monta aquí sino en el turno, que es de donde
 * cuelga. Esto es el fichero de canciones: buscar una, apuntar la nueva que
 * se va a estrenar, corregir un tono. La búsqueda va en la URL (`?q=`), como en
 * el panel, y funciona sin JavaScript.
 */
export default async function RepertorioEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    error?: string;
    guardado?: string;
    q?: string;
    archivadas?: string;
  }>;
}) {
  const { id } = await params;
  const { error, guardado, q, archivadas } = await searchParams;
  const datos = await cargar({ id, error, guardado, q, archivadas });
  return <VistaRepertorio {...datos} />;
}
