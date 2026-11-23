import type { Metadata } from 'next';

import { VistaTemas } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Próximos temas' };

/** Los próximos temas de una célula, en la app. Lo que pinta: `./vista.tsx`. */
export default async function TemasPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; grupoId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, grupoId } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, grupoId, error });
  return <VistaTemas {...datos} />;
}
