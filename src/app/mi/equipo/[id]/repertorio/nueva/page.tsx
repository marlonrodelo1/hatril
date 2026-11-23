import type { Metadata } from 'next';

import { VistaCancionNueva } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Apuntar una canción' };

/** La gemela de `/panel/ministerios/[id]/repertorio/nueva`. */
export default async function NuevaCancionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, error });
  return <VistaCancionNueva {...datos} />;
}
