/**
 * «Hace diez minutos», y a partir de una semana la fecha.
 *
 * Estaba suelta dentro de la página de avisos. Se saca porque ahora la usan dos
 * sitios —la página y la campana de la cabecera— y dos copias de esto acaban
 * diciendo «hace 1 días» en una de las dos.
 *
 * Se calcula en el servidor, así que el texto se congela hasta el siguiente
 * render. Es aceptable porque las dos pantallas que lo usan son
 * `force-dynamic`: se recalcula en cada carga.
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

  return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}
