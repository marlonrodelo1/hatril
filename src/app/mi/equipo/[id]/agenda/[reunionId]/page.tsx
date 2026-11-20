import type { Metadata } from 'next';

import { VistaReunionEquipo } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Pasar lista' };

/**
 * Pasar lista de un ensayo desde el móvil, en el propio ensayo.
 *
 * LA LISTA ES `listaDelEquipo()`, LA DEL PANEL
 * --------------------------------------------
 * Y no el equipo de `obtenerMinisterio`: aquella cruza la reunión con el
 * ministerio y deja fuera a quien negó el permiso de asistencia. Esta pantalla
 * no puede enseñar a nadie que la action no vaya a aceptar, ni la action
 * escribir a nadie que esta pantalla no enseñe.
 *
 * Una fila por persona, y la fila entera es la casilla: se marca con el pulgar
 * de pie en la sala, con el móvil en una mano (`PasarLista`). La primera vez
 * salen todos marcados, como en el panel —lo normal en un ensayo es que venga
 * casi todo el equipo, y es más rápido desmarcar a dos que marcar a doce—.
 *
 * El naranja es «Guardar la lista», fijo abajo para que no haya que bajar a
 * buscarlo con doce filas por medio. Editar va arriba como enlace y borrar, en
 * su tarjeta roja al final: ninguno de los dos es lo que se viene a hacer.
 */
export default async function ReunionEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; reunionId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, reunionId } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, reunionId, error, guardado });
  return <VistaReunionEquipo {...datos} />;
}
