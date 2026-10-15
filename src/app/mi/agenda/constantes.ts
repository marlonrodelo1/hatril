/**
 * Los textos de confirmación de contestar un turno.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async, y aquí porque los pintan dos pantallas: la agenda, si se
 * contestó desde su lista, y la del turno, si se contestó dentro.
 */
export const CONFIRMACIONES_TURNO: Record<string, string> = {
  confirmado: 'Apuntado. Gracias por servir.',
  // No promete un aviso: si nadie del equipo tiene la aplicación, no le llega a
  // nadie. Lo que sí es verdad siempre es que sale en su cuadrante.
  no_puede:
    'Apuntado que no puedes. Quien lleva el equipo lo verá en el cuadrante.',
};
