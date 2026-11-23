import type { Metadata } from 'next';

import { VistaTurnos } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Turnos' };

/**
 * Los turnos del equipo, en la app.
 *
 * VERSIÓN DE APP Y NO LA DEL PANEL DENTRO DEL MARCO
 * -------------------------------------------------
 * La del panel se ve bien a 375 px, pero cada fila está pensada para el ancho:
 * fecha a la izquierda, gente en medio, insignias a la derecha. En el móvil lo
 * que hay que leer de cada culto es una sola cosa —¿le falta algo?—, así que
 * aquí cada fila dice eso en una línea, con las mismas cuentas que la portada
 * (`estadoDeTurno`). Las consultas son las del panel, sin copiar ninguna.
 *
 * Los cinco anteriores, como en el panel, para copiar de ellos o mirar quién
 * fue: plegados, que no son lo que se viene a hacer.
 */
export default async function TurnosEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaTurnos {...datos} />;
}
