/**
 * Los textos de confirmación de la agenda.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async: exportar una constante desde ahí rompe el build y el
 * typecheck no lo caza, porque es una regla de Next y no de TypeScript.
 */
export const CONFIRMACIONES: Record<string, string> = {
  creada: 'Apuntado en la agenda.',
  editada: 'Cambios guardados.',
  lista: 'Lista guardada.',
  borrada: 'Borrado de la agenda.',
  // El segundo clic de un doble clic, o el mismo formulario enviado otra vez.
  // Con cuentas en la URL lo dice `confirmacionYaEstaba`; esto es si no traen.
  'ya-estaba': 'Ya estaba apuntado en la agenda.',
};

/**
 * Hasta cuántas semanas se puede repetir un ensayo de una vez.
 *
 * Doce, un trimestre. Más lejos el horario del equipo ya habrá cambiado, y
 * cincuenta filas creadas de un clic son cincuenta filas que alguien tendrá que
 * borrar a mano el día que el ensayo pase al miércoles.
 */
export const SEMANAS_MAXIMAS = 12;

/**
 * La confirmación de un ensayo repetido, con las cuentas.
 *
 * Con números y no con un texto fijo: si alguna semana ya tenía algo a esa
 * hora se ha saltado, y quien pulsó «doce semanas» tiene que saber que no hay
 * doce nuevas.
 */
export function confirmacionDeSemanas(creadas: number, saltadas: number): string {
  const hechas = `Apuntado en la agenda: ${creadas === 1 ? 'una semana' : `${creadas} semanas`}.`;
  if (saltadas === 0) return hechas;
  return saltadas === 1
    ? `${hechas} Otra ya tenía algo a esa hora y se ha dejado como estaba.`
    : `${hechas} Otras ${saltadas} ya tenían algo a esa hora y se han dejado como estaban.`;
}

/**
 * La respuesta al segundo clic, cuando el primero ya lo apuntó.
 *
 * Si alguna semana tiene otra cosa a esa hora se dice, para que nadie lea
 * «ya estaba» como «están todas» y salga a buscar las que faltan.
 */
export function confirmacionYaEstaba(estaban: number, otras: number): string {
  if (otras === 0) return CONFIRMACIONES['ya-estaba']!;
  const hechas = `Ya estaba apuntado: ${estaban === 1 ? 'una semana' : `${estaban} semanas`}.`;
  return otras === 1
    ? `${hechas} Otra tiene otra cosa a esa hora y no se ha tocado.`
    : `${hechas} Otras ${otras} tienen otra cosa a esa hora y no se han tocado.`;
}
