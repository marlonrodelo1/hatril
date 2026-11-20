import type { Metadata } from 'next';

import { VistaAgendaEquipo } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Agenda del equipo' };

/**
 * La agenda del equipo en la app: lo que viene y lo que ya pasó, con la lista
 * de cada uno.
 *
 * Lo que ya pasó lleva «Sin lista» cuando nadie la pasó, que no es lo mismo que
 * «no vino nadie» (ver `ReunionResumen.marcados`). Es lo único de esta lista
 * que pide algo, y por eso es lo único con icono.
 */
export default async function AgendaEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaAgendaEquipo {...datos} />;
}
