/**
 * El color del avatar de una persona.
 *
 * POR QUÉ EXISTE ESTO
 * -------------------
 * Todos los avatares eran el mismo círculo beige con dos letras. En un muro de
 * quince publicaciones eso son quince manchas idénticas, y la pantalla entera se
 * lee como un documento en vez de como una conversación entre personas. Fue la
 * queja repetida —«lo veo muy gris, no lo veo vivo»— y la superficie donde más
 * barato sale arreglarlo: no hay que rediseñar nada, solo dejar de pintar del
 * mismo color a gente distinta.
 *
 * DETERMINISTA, Y ESA ES LA GRACIA
 * --------------------------------
 * El color sale del nombre, así que Lucía es del mismo tono en el muro, en los
 * comentarios y en la cabecera, hoy y dentro de un año. Con un color al azar por
 * render, el avatar cambiaría de color en cada recarga y sería peor que el beige:
 * la vista aprende «el verde es Lucía» en dos pantallas, y perder eso rompe la
 * lectura rápida de quién ha escrito.
 *
 * Se usa una suma de códigos de carácter y no un hash criptográfico: aquí solo
 * hace falta repartir, no resistir a nadie. Y `normalize` para que «Lucía» y
 * «Lucia» —que pasa cuando alguien teclea sin acento— caigan en el mismo tono.
 *
 * LOS SEIS TONOS SALEN DE LA PALETA, NO DE UN GENERADOR
 * -----------------------------------------------------
 * Nada de `hsl(hash % 360)`, que es lo que se hace normalmente y produce el
 * fucsia y el amarillo flúor que ninguna de las cuarenta pantallas tiene. Son
 * seis parejas fondo/texto: las cuatro de las insignias —naranja de marca,
 * verde del «hecho», ámbar del aviso y rojo— más dos vecinos que hacían falta
 * para que seis personas seguidas no repitan. En el mismo orden que antes, para
 * que quien era verde lo siga siendo.
 *
 * Fondo tintado claro y letra oscura del mismo tono, como las insignias. En el
 * oscuro del 22-ago eran al revés, escritos en hex, y con la paleta crema se
 * habrían quedado como seis manchas casi negras. Por eso las cuatro primeras
 * apuntan a la variable de `globals.css` en vez de copiar su valor: siguen
 * solas el próximo cambio. Las dos últimas no tienen token y son las que habría
 * que repasar a mano.
 *
 * Las variables solo existen dentro de la página: en un correo o en una imagen
 * generada en el servidor no resolverían.
 *
 * El texto es de 11–12px en negrita, así que necesita 4.5:1. Medidas sobre su
 * propio fondo con la paleta del 15-oct: 5.6, 6.7, 6.8, 7.3, 6.5 y 6.6.
 */

export type ColorAvatar = { fondo: string; texto: string };

const TONOS: readonly ColorAvatar[] = [
  // Naranja de marca.
  { fondo: 'var(--hatril-badge-accent-bg)', texto: 'var(--hatril-badge-accent-fg)' },
  // Verde del estado «hecho»: el de apoyo ya no es verde.
  { fondo: 'var(--hatril-badge-success-bg)', texto: 'var(--hatril-badge-success-fg)' },
  // Ámbar del aviso.
  { fondo: 'var(--hatril-badge-warning-bg)', texto: 'var(--hatril-badge-warning-fg)' },
  // Rojo, el color del corazón que le gusta a Marlon.
  { fondo: 'var(--hatril-badge-danger-bg)', texto: 'var(--hatril-badge-danger-fg)' },
  // Azul pizarra: no está en la paleta de marca, y hace falta un frío que no
  // sea el verde para que dos personas seguidas no se confundan.
  { fondo: '#e3eaf1', texto: '#305477' },
  // Morado apagado, mismo motivo. Apagado a propósito: un violeta saturado
  // sería el único color de la aplicación que no viene de ningún sitio.
  { fondo: '#eae7f1', texto: '#58477e' },
];

export function colorAvatar(nombre: string): ColorAvatar {
  const limpio = nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

  if (!limpio) return TONOS[0]!;

  let suma = 0;
  for (let i = 0; i < limpio.length; i++) {
    suma += limpio.charCodeAt(i);
  }

  return TONOS[suma % TONOS.length]!;
}
