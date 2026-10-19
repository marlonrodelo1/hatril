/**
 * Los textos de confirmación del repertorio.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async. Y ojo con lo contrario, que es peor: cualquier función async
 * exportada desde ahí es un endpoint que se puede llamar desde fuera, así que
 * los ayudantes de esas actions tampoco se exportan.
 */
export const CONFIRMACIONES: Record<string, string> = {
  creada: 'Canción añadida al repertorio.',
  editada: 'Cambios guardados.',
  archivada: 'Archivada. Ya no sale al elegir canciones, y su historia se queda.',
  recuperada: 'De vuelta en el repertorio.',
  borrada: 'Canción borrada.',
};
