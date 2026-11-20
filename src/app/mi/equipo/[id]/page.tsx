import type { Metadata } from 'next';

import { VistaPortada } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Equipo' };

/**
 * La portada de un equipo en la app: lo que pide atención, módulo a módulo.
 *
 * Se monta entera a partir de `modulosActivos()` y del adaptador de cada
 * módulo (`lib/ministerios/en-la-app/registro.ts`). Esta pantalla no sabe qué
 * es un turno: si el pastor enciende el repertorio, aparece su tarjeta; si
 * mañana se fusiona el reparto, aparece la suya.
 *
 * DOS MODOS, UNA PANTALLA
 * -----------------------
 * Quien lleva el equipo ve lo que hay que arreglar y entra a sus herramientas.
 * Quien participa ve lo suyo —sus turnos, el próximo ensayo, la lista del
 * domingo— con enlaces a su agenda, y nada de lo que es del líder. Lo decide
 * `requireMiEquipo`, y cada adaptador dice qué enseña en cada modo.
 *
 * Arriba, una sola línea con el total: la pregunta con la que se abre esto el
 * sábado por la noche es «¿falta algo para mañana?», y tiene que contestarse
 * sin bajar.
 */
export default async function PortadaMinisterioPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const datos = await cargar({ id, error });
  return <VistaPortada {...datos} />;
}
