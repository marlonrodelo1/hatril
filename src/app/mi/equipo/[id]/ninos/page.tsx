import type { Metadata } from 'next';

import { VistaNinos } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Tablón de familias' };

/** El tablón de Niños para los maestros, en la app. Lo que pinta: `./vista.tsx`. */
export default async function NinosEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaNinos {...datos} />;
}
