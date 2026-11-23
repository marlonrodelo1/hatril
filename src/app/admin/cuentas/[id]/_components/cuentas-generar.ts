/**
 * La contraseña provisional, generada para dictarla por teléfono.
 *
 * POR QUÉ PALABRAS Y NO LETRAS SUELTAS
 * ------------------------------------
 * Esta contraseña se dicta: el super admin al teléfono y el pastor apuntando.
 * «k7Qp2xRm» se dicta letra a letra, con «¿la ka mayúscula o minúscula?» en
 * cada una. «Pino-Arena-472» se dice en tres golpes y cumple la regla sola:
 * mayúsculas al principio de cada palabra, minúsculas detrás y un número.
 *
 * LA LISTA
 * --------
 * Palabras corrientes, sin tildes ni eñes, y además sin las letras que al
 * dictar se escriben de dos maneras: ni b ni v, ni h, ni ll ni y, ni c ante e
 * o i, ni z, ni g ante e o i, ni j. Se habla con Canarias y con Colombia, que
 * sesean: «Cedro» puede acabar escrito «Sedro», y «Ola», «Hola». Fuera
 * también lo que en algún sitio es una palabra malsonante.
 *
 * Sesenta y cuatro: dos palabras distintas y un número de tres cifras dan unos
 * 3,6 millones de combinaciones. No es la entropía de una contraseña elegida
 * al azar de verdad, y no hace falta: es provisional, hay que conocer el correo
 * de la cuenta para probarla y Supabase limita los intentos de entrada. Con dos
 * cifras eran diez veces menos, a cambio de nada.
 *
 * `crypto.getRandomValues` y no `Math.random`: este último no está pensado
 * para secretos, y que una contraseña salga de él se ve mal en cualquier
 * revisión aunque aquí el riesgo sea pequeño.
 */
export const PALABRAS = [
  'Pino', 'Arena', 'Monte', 'Luna', 'Faro', 'Trigo', 'Lago', 'Piedra',
  'Puerto', 'Mapa', 'Lima', 'Mango', 'Rosa', 'Perla', 'Plata', 'Coral',
  'Tigre', 'Puma', 'Loro', 'Gato', 'Palma', 'Duna', 'Isla', 'Flor',
  'Fresa', 'Menta', 'Canela', 'Torre', 'Puente', 'Tierra', 'Fuego', 'Roca',
  'Campo', 'Senda', 'Ruta', 'Pluma', 'Tinta', 'Papel', 'Marco', 'Puerta',
  'Patio', 'Mesa', 'Remo', 'Tomate', 'Ancla', 'Nido', 'Norte', 'Agua',
  'Camino', 'Oro', 'Sol', 'Mar', 'Nota', 'Tela', 'Lana', 'Seda',
  'Miel', 'Pasto', 'Prado', 'Arpa', 'Rama', 'Coco', 'Pista', 'Flauta',
] as const;

/** Un entero de 0 a n-1, todos con la misma probabilidad. */
function alAzar(n: number): number {
  // Se descarta el último tramo incompleto: con `% n` a secas, los primeros
  // valores saldrían un pelo más a menudo que los demás.
  const limite = Math.floor(2 ** 32 / n) * n;
  const caja = new Uint32Array(1);
  let x: number;
  do {
    crypto.getRandomValues(caja);
    x = caja[0];
  } while (x >= limite);
  return x % n;
}

export function generarContrasena(): string {
  const a = alAzar(PALABRAS.length);
  // Una segunda palabra distinta sin volver a tirar: se elige entre las otras
  // sesenta y tres y se salta la primera.
  let b = alAzar(PALABRAS.length - 1);
  if (b >= a) b += 1;
  const numero = 100 + alAzar(900);
  return `${PALABRAS[a]}-${PALABRAS[b]}-${numero}`;
}
