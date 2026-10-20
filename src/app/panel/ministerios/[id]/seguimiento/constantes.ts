/**
 * Los textos de confirmación. Fuera de `actions.ts`: un fichero `'use server'`
 * solo puede exportar funciones async, y el typecheck no caza lo contrario.
 */
export const CONFIRMACIONES: Record<string, string> = {
  contacto: 'Contacto apuntado.',
  asignado: 'Cambiado quién le acompaña.',
  borrado: 'Contacto borrado.',
  alta: 'Apuntado como visitante. Ahora elige quién le acompaña y apunta la primera llamada.',
  existe: 'Ya estaba en el fichero con ese nombre y ese teléfono. Es esta ficha: no se ha creado otra.',
  sinPermiso:
    'Apuntado. Como no quiere que se apunte si viene, no sale en Nuevos ni en las listas, y aquí no se le pueden apuntar llamadas.',
};
