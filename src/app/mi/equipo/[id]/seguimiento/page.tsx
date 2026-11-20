import type { Metadata } from 'next';

import { VistaSeguimiento } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Seguimiento' };

/**
 * A quién llamar, desde el móvil.
 *
 * La lista es `personasPorFaltas`, la del panel: quien negó el permiso de
 * asistencia no sale, y el orden es el suyo —quien más se ha perdido, primero—.
 * La guarda (`requireMinisterioEnLaApp(id, 'seguimiento')`) pide además
 * `ver_seguimiento` a través del adaptador, la misma puerta de más que el
 * `layout.tsx` del panel.
 *
 * EL TELÉFONO, A UN TOQUE Y FUERA DE LA FILA
 * ------------------------------------------
 * Cada fila lleva a la ficha, y el teléfono es un botón aparte a su derecha:
 * un enlace `tel:` dentro de otro enlace no es HTML válido, y en el móvil el
 * toque acabaría en uno o en otro según dónde caiga el dedo. Llamar primero y
 * apuntar después es el orden real, así que el botón está en la lista y no
 * solo en la ficha.
 */
export default async function SeguimientoEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, error, guardado });
  return <VistaSeguimiento {...datos} />;
}
