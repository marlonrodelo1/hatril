import type { Metadata } from 'next';

import { VistaGrupo } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Tu grupo' };

/** La célula de quien la lleva, en la app. Lo que pinta: `./vista.tsx`. */
export default async function MiGrupoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; grupoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string; semana?: string; cambiar?: string }>;
}) {
  const { id, grupoId } = await params;
  const { error, guardado, semana, cambiar } = await searchParams;
  const datos = await cargar({ id, grupoId, error, guardado, semana, cambiar });
  return <VistaGrupo {...datos} />;
}
