/**
 * Los textos de confirmación. Fuera de `actions.ts`: un fichero `'use server'`
 * solo puede exportar funciones async, y el typecheck no caza lo contrario.
 */
export const CONFIRMACIONES: Record<string, string> = {
  contacto: 'Contacto apuntado.',
  asignado: 'Cambiado quién le acompaña.',
  borrado: 'Contacto borrado.',
};
