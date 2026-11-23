import type { Metadata } from 'next';

import { VistaRed } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Grupos' };

/** La red de quien la lleva, en la app. Lo que pinta: `./vista.tsx`. */
export default async function RedEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaRed {...datos} />;
}
