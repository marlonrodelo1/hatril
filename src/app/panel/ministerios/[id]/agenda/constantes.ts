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
};
