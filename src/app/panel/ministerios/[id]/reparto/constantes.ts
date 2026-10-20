/**
 * Los textos de confirmación del reparto.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async, y cualquier función exportada desde ahí es un endpoint.
 */
export const CONFIRMACIONES: Record<string, string> = {
  empezado: 'Reparto de hoy empezado. Busca a cada persona por su número o su nombre.',
  llegada: 'Apuntado: ha llegado.',
  entregado: 'Entregado.',
  deshecho: 'Deshecho: vuelve a estar esperando.',
  quitado: 'Quitado de la lista de hoy.',
  'sin-apuntar': 'Contado.',
  editado: 'Cambios guardados.',
  baja: 'Dado de baja. Sigue en el padrón y se puede reactivar.',
  reactivado: 'De vuelta en el padrón.',
  borrado: 'Borrado. Las entregas de otros días se quedan contadas, sin nombre.',
  borrados:
    'Borrados quienes llevaban más de un año sin venir. Sus entregas se quedan contadas, sin nombre.',
};
