import type { Metadata } from 'next';

import { VistaTurnoEquipo } from './vista';
import { cargar } from './datos';

export const metadata: Metadata = { title: 'Turno' };

/**
 * El cuadrante de un culto en la app: quién va a cada puesto, quién ha
 * contestado, y qué se toca.
 *
 * Es la pantalla del sábado por la noche, después de que alguien escriba en el
 * grupo que mañana no puede. Por eso arriba va la línea de lo que falta, con las
 * mismas cuentas que la portada, y cada puesto debajo con su gente.
 *
 * LA RESPUESTA, CON PALABRAS Y NO CON ICONOS SUELTOS
 * --------------------------------------------------
 * En el panel, cambiar la respuesta de alguien son dos iconos con su `title`
 * al pasar el ratón. En el móvil no hay ratón: serían dos dibujos sin nombre al
 * lado de cada persona. Aquí van escritas, como fichas: la insignia dice lo que
 * contestó y debajo las otras dos. Es para el bajista que contestó «sí» en el
 * grupo de WhatsApp y no en la aplicación.
 *
 * SIN NARANJA
 * -----------
 * Cada puesto tiene su «Añadir», cada canción sus flechas. Con un naranja en
 * cualquiera de ellos habría siete, así que todo va en contorno y la regla de
 * uno por pantalla se cumple por abajo. Borrar va al final en su propia
 * tarjeta roja, como en eventos.
 */
export default async function TurnoEnLaAppPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; turnoId: string }>;
  searchParams: Promise<{ error?: string; guardado?: string }>;
}) {
  const { id, turnoId } = await params;
  const { error, guardado } = await searchParams;
  const datos = await cargar({ id, turnoId, error, guardado });
  return <VistaTurnoEquipo {...datos} />;
}
