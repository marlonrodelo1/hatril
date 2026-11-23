import type { Metadata } from 'next';

import { VistaSeguimientoPersona } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Seguimiento de una persona' };

/**
 * Llamar a alguien y apuntar lo que pasó, desde el móvil.
 *
 * LA PERSONA SALE DE LA LISTA, NO DE `miembros`
 * ---------------------------------------------
 * Como en el panel: `personasPorFaltas` es la única puerta, y de ahí sale el
 * 404 para quien negó el permiso de asistencia. Una consulta directa a la ficha
 * reabriría su seguimiento con solo saber su uuid.
 *
 * El orden es el del gesto: arriba el botón de llamar, debajo el formulario de
 * lo que pasó —con la fecha de hoy ya puesta—, y después la historia. El
 * naranja es «Apuntar el contacto». Llamar es un enlace `tel:` en contorno: es
 * una salida de la app, no lo que se guarda.
 */
export default async function PersonaEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; miembroId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, miembroId } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, miembroId, error, guardado });
  return <VistaSeguimientoPersona {...datos} />;
}
