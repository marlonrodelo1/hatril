import type { Metadata } from 'next';

import { VistaFamilias } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Familias del ministerio' };

/** Las familias de Niños, en la app. Lo que pinta: `./vista.tsx`. */
export default async function FamiliasEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaFamilias {...datos} />;
}
