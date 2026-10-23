/**
 * Los textos de confirmación de los grupos y lo que comparten las pantallas.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async, y cualquier función exportada desde ahí es un endpoint.
 */
export const CONFIRMACIONES: Record<string, string> = {
  // Sin género: la misma pieza son células, clases o grupos (`etiquetas.ts`).
  creado: 'Listo. Ya puedes sumar a su gente y compartir su enlace de invitación.',
  editado: 'Cambios guardados.',
  lider: 'Hecho: tiene nuevo líder.',
  auxiliar: 'Hecho: ahora es auxiliar y puede reportar la semana desde la app.',
  'sin-auxiliar': 'Hecho: sigue dentro como uno más, sin llevar nada.',
  anadidos: 'Sumados.',
  quitado: 'Quitado. Su historial no se pierde.',
  codigo: 'Enlace nuevo. El anterior ya no sirve para entrar.',
  cerrado: 'Hecho: ya no sale en la lista y su enlace deja de valer.',
  guia: 'Guía guardada. Se propone a cada grupo que no tenga su propio tema.',
  reporte: 'Semana reportada. Gracias.',
  temas: 'Temas guardados.',
};

/** Cuántas semanas por delante se planifican: la guía de la red y los temas. */
export const SEMANAS_POR_DELANTE = 4;

/** Los días en el orden de una semana de aquí: lunes primero. */
export const DIAS_DEL_FORMULARIO = [
  { valor: 1, nombre: 'Lunes' },
  { valor: 2, nombre: 'Martes' },
  { valor: 3, nombre: 'Miércoles' },
  { valor: 4, nombre: 'Jueves' },
  { valor: 5, nombre: 'Viernes' },
  { valor: 6, nombre: 'Sábado' },
  { valor: 0, nombre: 'Domingo' },
] as const;
