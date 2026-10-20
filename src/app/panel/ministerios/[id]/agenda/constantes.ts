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
