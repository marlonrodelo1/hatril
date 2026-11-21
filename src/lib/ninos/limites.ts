/**
 * Los límites del drive de Niños, compartidos entre el servidor y el
 * componente que sube desde el navegador.
 *
 * Sin `server-only`: el teléfono tiene que rechazar un vídeo de 300 MB ANTES de
 * mandarlo, no después de gastar los datos de quien lo sube. Los mismos números
 * están en los buckets y en los CHECK de `ninos_archivos` (`0059`, `0060`), que
 * son los que de verdad mandan.
 */

/** 5 MB. Una foto ya reducida en el teléfono ronda los 400 KB. */
export const MAX_BYTES_FOTO = 5 * 1024 * 1024;

/** 100 MB: entre 45 segundos y un minuto en 1080p, según el teléfono. */
export const MAX_BYTES_VIDEO = 100 * 1024 * 1024;

/** Un minuto. Lo dice el teléfono; el límite que manda es el de los bytes. */
export const MAX_DURACION_VIDEO_S = 60;

/** El lado largo al que el teléfono reduce cada foto. */
export const LADO_FOTO = 1600;

/** El lado largo de la miniatura que se pinta en el drive y el tablón. */
export const LADO_MINIATURA = 400;

/** Cuántos ficheros de una vez, para que una subida no se eternice. */
export const MAX_FICHEROS_POR_SUBIDA = 20;

export const TIPOS_VIDEO = ['video/mp4', 'video/quicktime'] as const;

/**
 * «1 de diciembre de 2027»: el día en que se borra algo del drive o del tablón.
 *
 * Con el año, a diferencia de `formatearFechaLarga`: el borrado cae siempre
 * al año siguiente, y «el 1 de diciembre» a secas se lee como dentro de diez
 * días. Partida a mano por lo mismo que aquella: `new Date('2027-12-01')` es
 * medianoche UTC y en Bogotá se pintaría el 30 de noviembre.
 */
export function fechaDeBorrado(fecha: string): string {
  const [a, m, d] = fecha.split('-').map(Number);
  return new Date(a!, m! - 1, d!).toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}
