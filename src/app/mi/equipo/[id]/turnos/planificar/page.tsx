import type { Metadata } from 'next';

import { VistaPlanificar } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Planificar turnos' };

/**
 * En qué cultos de las próximas semanas sirve el equipo.
 *
 * Salen del horario de la iglesia con `cultosParaPlanificar`, la consulta del
 * panel, y vienen marcados los que el pastor señaló como destacados. Los que ya
 * tienen turno se enseñan también, con su enlace: ver el domingo como «ya
 * planificado» contesta por qué no se puede marcar.
 *
 * El naranja es «Añadir los marcados», que es lo que se viene a hacer. El
 * culto suelto va debajo en contorno.
 */
export default async function PlanificarEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, error });
  return <VistaPlanificar {...datos} />;
}
