/**
 * Constantes de la sección de eventos.
 *
 * En un fichero aparte de `actions.ts` porque **un módulo con `'use server'`
 * solo puede exportar funciones async**. Exportar una constante desde ahí rompe
 * el build entero, el typecheck no lo caza —es regla de Next, no de
 * TypeScript— y el error de Turbopack señala a quien importa, no a la causa.
 * Ya pasó con `ajustes/constantes.ts`.
 */

export const DESTINO = '/panel/eventos';

/** Tope de acompañantes por inscripción. Igual que el CHECK de la base. */
export const MAX_ACOMPANANTES = 10;

export const CONFIRMACIONES: Record<string, string> = {
  creado: 'Evento creado. Todavía no está publicado.',
  guardado: 'Evento guardado.',
  publicado: 'Evento publicado. Ya sale en la web de la iglesia.',
  despublicado: 'Evento retirado de la web.',
  abiertas: 'Inscripciones abiertas.',
  cerradas: 'Inscripciones cerradas. El evento sigue anunciado.',
  borrado: 'Evento borrado, con su lista de inscritos.',
  pagada: 'Marcada como pagada.',
  'pago-quitado': 'Ya no consta como pagada.',
  'inscripcion-cancelada': 'Inscripción cancelada.',
  'lista-borrada': 'Lista de inscritos borrada.',
};
