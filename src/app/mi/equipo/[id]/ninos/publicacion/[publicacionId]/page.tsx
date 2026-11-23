import type { Metadata } from 'next';

import { VistaPublicacion } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Publicación del tablón' };

/** Una publicación del tablón de Niños, en la app. Lo que pinta: `./vista.tsx`. */
export default async function PublicacionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; publicacionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, publicacionId } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, publicacionId, error, guardado });
  return <VistaPublicacion {...datos} />;
}
