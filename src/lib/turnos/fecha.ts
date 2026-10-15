import { formatearFechaLarga } from '@/lib/fecha/hoy';

/**
 * «domingo, 19 de octubre a las 11:00».
 *
 * Para los avisos y las cabeceras de un turno. La hora va escrita y no con un
 * punto medio porque en un aviso se lee de corrido, como una frase.
 */
export function cuandoEs(fecha: string, hora: string | null): string {
  const dia = formatearFechaLarga(fecha);
  return hora ? `${dia} a las ${hora}` : dia;
}
