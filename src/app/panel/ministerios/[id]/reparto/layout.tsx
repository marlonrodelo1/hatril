import { notFound } from 'next/navigation';

import { requireGestionMinisterio } from '@/lib/auth/guard-panel';
import { obtenerMinisterio } from '@/lib/ministerios/consultas';
import { tieneModulo } from '@/lib/ministerios/modulos';

/**
 * El guard del reparto. Las dos puertas de los otros módulos, con la primera
 * más estrecha:
 *
 *   1. `requireGestionMinisterio(id, { desdeDentro: true })` — el pastor, o el
 *      responsable y los colíderes de ESTE equipo. Sin `gestionar_ministerios`:
 *      la RLS de la `0042` es por equipo, y a quien no está en él la base no le
 *      enseña el padrón. Abrirle la pantalla sería darle un listado vacío.
 *   2. El módulo encendido. Apagado, la ruta no existe para ese ministerio.
 *
 * Aquí y no en cada página, porque debajo cuelga `padron/[beneficiarioId]`, que
 * es la ficha de una persona que está pasando necesidad. Las actions llevan las
 * mismas dos puertas por su cuenta: un layout no corre en una server action.
 */
export default async function RepartoLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  const ctx = await requireGestionMinisterio(id, { desdeDentro: true });

  const ministerio = await obtenerMinisterio(ctx, id);
  if (!ministerio) notFound();
  if (!tieneModulo(ministerio.modulos, 'reparto')) notFound();

  return <>{children}</>;
}
