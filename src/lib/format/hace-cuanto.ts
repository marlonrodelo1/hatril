/**
 * «Hace diez minutos», y a partir de una semana la fecha.
 *
 * SE CALCULA EN EL SERVIDOR, SIEMPRE
 * ----------------------------------
 * Vivía dentro de `publicacion.tsx`, que es un componente de servidor, y ahí
 * daba igual. Sale a este módulo porque ahora los comentarios se pintan en un
 * componente de CLIENTE —la hoja que sube desde abajo— y la tentación es
 * llamarla allí.
 *
 * No se hace: `Date.now()` en el cliente devuelve un instante distinto del que
 * usó el servidor al renderizar, así que «hace 3 min» y «hace 4 min» chocan al
 * hidratar y React avisa por consola. La regla es que el texto viaja ya escrito
 * desde el servidor, y el cliente solo lo pinta.
 *
 * El precio, que ya se pagaba antes, es que usa la hora del SERVIDOR y no la
 * del móvil de quien mira. Para «hace un rato» da igual; para la fecha larga
 * también, porque se formatea en español y sin hora.
 */
export function haceCuanto(fecha: Date): string {
  const segundos = Math.max(0, (Date.now() - fecha.getTime()) / 1000);

  if (segundos < 60) return 'ahora mismo';

  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `hace ${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `hace ${dias} días`;

  return fecha.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
  });
}
