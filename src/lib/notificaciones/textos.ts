import type { TipoNotificacion } from './emitir';

/**
 * El texto de cada aviso, compuesto al pintarlo.
 *
 * En la fila solo van el tipo y los datos. Guardar la frase entera parece más
 * simple hasta el día que hay que corregir una palabra: las filas viejas seguirían
 * diciendo lo de antes para siempre, y las de una iglesia que ya recibió el aviso
 * no se pueden reescribir sin tocar datos que no son nuestros. Así, el texto es
 * código y se corrige en un despliegue.
 *
 * Aquí no se traduce nada todavía. Cuando haya que hacerlo, este es el único
 * fichero que cambia.
 */
export function textoNotificacion(
  tipo: TipoNotificacion,
  datos: Record<string, string>,
): { titulo: string; detalle: string | null } {
  const quien = datos.quien ?? 'Alguien';

  switch (tipo) {
    case 'solicitud_recibida':
      return {
        titulo: `${quien} quiere unirse a la iglesia`,
        detalle: datos.mensaje ?? null,
      };

    case 'solicitud_aprobada':
      return {
        titulo: `Ya eres parte de ${datos.iglesia ?? 'la iglesia'}`,
        detalle: 'Ya puedes ver lo que publica tu congregación.',
      };

    case 'solicitud_rechazada':
      return {
        titulo: `Tu solicitud en ${datos.iglesia ?? 'la iglesia'} no ha salido adelante`,
        // El motivo solo si lo escribieron. «Sin motivo» de relleno es peor que
        // nada: da a entender que hubo uno y no se quiso contar.
        detalle: datos.motivo ?? null,
      };

    case 'comentario_en_publicacion':
      return {
        titulo: `${quien} ha comentado tu publicación`,
        detalle: datos.extracto ?? null,
      };

    case 'me_gusta_en_publicacion':
      return {
        titulo: `A ${quien} le gusta tu publicación`,
        detalle: null,
      };

    case 'turno_devocional':
      return {
        titulo: 'Te toca escribir el devocional',
        detalle: datos.fecha ? `Es para el ${datos.fecha}.` : null,
      };
  }
}
