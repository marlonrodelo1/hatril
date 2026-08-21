/**
 * Los textos de confirmación de la sección.
 *
 * Viven aquí y no en `actions.ts` porque un fichero `'use server'` solo puede
 * exportar funciones async. Exportar una constante desde ahí rompe el build
 * entero y el typecheck NO lo caza: es una regla de Next, no de TypeScript, y
 * aparece al abrir la pantalla. Mismo patrón que `ajustes/constantes.ts`.
 */
export const CONFIRMACIONES: Record<string, string> = {
  creada: 'Reunión apuntada.',
  editada: 'Cambios guardados.',
  lista: 'Lista guardada.',
  borrada: 'Reunión borrada.',
};
