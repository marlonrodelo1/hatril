/**
 * Los topes del muro, en un fichero que pueden leer los dos lados.
 *
 * `lib/comunidad/imagenes.ts` es `server-only` —trae el service role— y el
 * publicador es un componente de cliente que necesita el mismo número para
 * decir «hasta 4 fotos». Importarlo de allí rompe la compilación con un error de
 * los que no se entienden a la primera; duplicarlo a mano acaba con dos números
 * distintos el día que uno cambie.
 */

/** Cuatro fotos por publicación. Más es un álbum, y un álbum es otra pantalla. */
export const MAX_IMAGENES = 4;

/** 5 MB por foto, el mismo tope que declara el bucket en la migración `0015`. */
export const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;
