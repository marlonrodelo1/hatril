import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * El guard del repertorio. Las mismas dos puertas que la agenda y los turnos:
 * quién (lleva este ministerio) y qué (el módulo encendido; si no, 404).
 *
 * `nueva` y `[cancionId]` cuelgan de aquí. Las actions no: cada una lleva su
 * `requireGestionMinisterioAccion`, porque un layout no se vuelve a ejecutar al
 * navegar y una server action no pasa por él.
 */
export default async function RepertorioLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const ctx = await requireGestionMinisterio(id);

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();
  if (!tieneModulo(ministerio.modulos, 'repertorio')) notFound();

  return <>{children}</>;
}
