/**
 * Los textos de confirmación del tablón de familias.
 *
 * Fuera de `actions.ts` porque un fichero `'use server'` solo puede exportar
 * funciones async. Las páginas los buscan con `Object.hasOwn`: un
 * `?guardado=constructor` no puede pintar nada.
 */
export const CONFIRMACIONES: Record<string, string> = {
  aceptada: 'Familia aceptada. Desde hoy ve el tablón del ministerio en su app.',
  rechazada: 'Petición rechazada y borrada. No queda nada de ella.',
  quitada: 'Vínculo quitado. Si era la única familia del niño, se han borrado su nombre y su año.',
  clase: 'Clase guardada en el cronograma.',
  'clase-borrada': 'Clase borrada del cronograma.',
  creada: 'Borrador creado. Añade las fotos y publícalo cuando esté listo.',
  editada: 'Cambios guardados.',
  publicada: 'Publicado. Las familias aceptadas ya lo ven en su app.',
  retirada: 'Retirada del tablón: vuelve a ser un borrador y las familias dejan de verla.',
  borrada: 'Publicación borrada. Sus fotos siguen en el drive.',
  adjuntados: 'Añadidos a la publicación.',
  'quitado-de-publicacion': 'Quitado de la publicación. Sigue en el drive.',
  'archivo-borrado': 'Borrado del drive.',
};

/** Cómo se dice el parentesco en pantalla. */
export const PARENTESCOS: Record<string, string> = {
  madre: 'Madre',
  padre: 'Padre',
  tutor_legal: 'Tutor legal',
};
