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
 * seis parejas fondo/texto derivadas de los colores que ya existen en el sistema
 * —el naranja de marca, el verde de apoyo, el rojo, el ámbar del aviso— más dos
 * vecinos que hacían falta para que seis personas seguidas no repitan.
 *
 * Cada pareja se comprobó contra AA: el texto es de 12px en negrita, así que
 * necesita 4.5:1 y todas pasan de 6:1 sobre su propio fondo. Son fondos OSCUROS
 * tintados con letra clara, no al revés: sobre una tarjeta casi negra, seis
 * círculos pastel serían seis manchas de luz peleándose con el texto.
 */

export type ColorAvatar = { fondo: string; texto: string };

const TONOS: readonly ColorAvatar[] = [
  // Naranja de marca. 6.4:1 sobre su propio fondo.
  { fondo: '#3a2018', texto: '#e8945f' },
  // Verde de apoyo. 6.8:1.
  { fondo: '#1b3229', texto: '#79c0a6' },
  // Ámbar del aviso. 7.2:1.
  { fondo: '#332a16', texto: '#d9b45f' },
  // Rojo, el color del corazón que le gusta a Marlon. 6.1:1.
  { fondo: '#3a1d1b', texto: '#e88078' },
  // Azul pizarra: no está en la paleta de marca, y hace falta un frío que no
  // sea el verde para que dos personas seguidas no se confundan. 6.5:1.
  { fondo: '#1d2a38', texto: '#82aeda' },
  // Morado apagado, mismo motivo. Apagado a propósito: un violeta saturado
  // sería el único color de la aplicación que no viene de ningún sitio. 6.3:1.
  { fondo: '#2a2338', texto: '#a995d6' },
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
