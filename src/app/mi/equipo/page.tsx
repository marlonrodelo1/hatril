import type { Metadata } from 'next';

import { VistaEquipos } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Equipo' };

/**
 * La pestaña «Equipo»: los equipos en los que sirve esta persona.
 *
 * Con uno solo no hay nada que elegir y se va directo a su portada; la pestaña
 * ya apunta ahí (`mi/layout.tsx`), esto cubre a quien llegue escribiendo la
 * dirección o desde un enlace viejo.
 *
 * Con varios, dos bloques: «Lo que llevas», donde entra a sus herramientas, y
 * «Donde sirves», donde ve lo suyo. Separados porque son dos cosas que se
 * vienen a hacer distintas, y mezclados el voluntario no sabría por qué en una
 * fila hay «2 pendientes» y en la otra no. En cada fila, cuántas cosas piden
 * atención y las dos primeras; si no hay, lo siguiente que viene.
 */
export default async function EquipoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const datos = await cargar({ error });
  return <VistaEquipos {...datos} />;
}
