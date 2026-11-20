import type { Metadata } from 'next';

import { VistaReunionEditar } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Cambiar la reunión' };

/** La gemela de `/panel/ministerios/[id]/agenda/[reunionId]/editar`. */
export default async function EditarReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id, reunionId } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, reunionId, error });
  return <VistaReunionEditar {...datos} />;
}
