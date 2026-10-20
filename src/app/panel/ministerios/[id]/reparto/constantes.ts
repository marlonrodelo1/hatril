/**
 * Los textos de confirmación del reparto.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async, y cualquier función exportada desde ahí es un endpoint.
 */
export const CONFIRMACIONES: Record<string, string> = {
  empezado: 'Reparto de hoy empezado. Busca a cada persona por su número o su nombre.',
  llegada: 'Ha llegado: ya está en la cola.',
  entregado: 'Entregado.',
  deshecho: 'Deshecho: vuelve a estar esperando.',
  quitado: 'Quitado de la lista de hoy.',
  'sin-inscribir': 'Entregado sin inscribir: se cuenta y no se guarda a nadie.',
  'sin-inscribir-menos': 'Corregido: uno menos sin inscribir.',
  editado: 'Cambios guardados.',
  baja: 'Dado de baja: sale de la lista y del recuento, pero conserva su número y se puede reactivar.',
  reactivado: 'Reactivado: vuelve a la lista del padrón.',
  borrado: 'Borrado. Las entregas de otros días se quedan contadas, sin nombre.',
  borrados:
    'Borrados quienes llevaban más de un año sin venir. Sus entregas se quedan contadas, sin nombre.',
};
