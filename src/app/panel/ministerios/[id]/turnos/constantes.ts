/**
 * Los textos de confirmación de los turnos.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async: exportar una constante desde ahí rompe el build y el
 * typecheck no lo caza, porque es una regla de Next y no de TypeScript.
 */
export const CONFIRMACIONES: Record<string, string> = {
  planificados: 'Cultos añadidos. Ahora ponle gente a cada uno.',
  creado: 'Turno creado. Ponle gente a cada puesto.',
  editado: 'Cambios guardados.',
  borrado: 'Turno borrado.',
  asignado: 'Asignado. Si tiene la aplicación, ya le ha llegado el aviso.',
  quitado: 'Quitado del turno.',
  respuesta: 'Respuesta apuntada.',
  copiado: 'Copiado. Le ha llegado el aviso a quien tiene la aplicación.',
  puestos: 'Puestos guardados.',
};
