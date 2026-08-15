/**
 * Formato único de teléfono para toda la plataforma.
 *
 * POR QUÉ EXISTE
 * --------------
 * El teléfono es la CLAVE con la que se reconoce a un cliente: hay un índice
 * único `(salon_id, telefono)` y todos los flujos de reserva buscan por él
 * antes de crear la ficha. Pero ese índice compara TEXTO EXACTO, y cada sitio
 * guardaba lo que el cliente hubiera tecleado. Resultado real medido sobre la
 * base de datos: de 333 teléfonos solo 33 estaban en un formato consistente, y
 * 16 personas tenían DOS fichas —"667008500" y "667 008 500"— con su historial
 * partido entre las dos.
 *
 * Por eso todo lo que escriba un teléfono en `clientes` pasa por aquí antes,
 * tanto para BUSCAR como para INSERTAR. Si un solo camino se lo salta, vuelven
 * los duplicados.
 *
 * FORMATO CANÓNICO: E.164 sin espacios → `+34667008500`.
 *
 * Es deliberadamente compatible con `normalizarTelefonoWhatsapp`
 * (src/lib/whatsapp/twilio.ts): lo que sale de aquí siempre empieza por `+`,
 * que es la primera rama que esa función acepta. Los envíos de WhatsApp siguen
 * funcionando igual, y de hecho mejoran, porque dejan de recibir cadenas con
 * espacios.
 */

/** Longitud de un número nacional español (móvil o fijo), sin prefijo de país. */
const DIGITOS_ES = 9;

/** Prefijos válidos de un número español: 6 y 7 móviles, 8 y 9 fijos. */
const INICIO_ES = /^[6789]/;

/**
 * Pasa un teléfono a E.164 (`+34667008500`), o devuelve null si no es un
 * número utilizable.
 *
 * Acepta lo que la gente escribe de verdad: "667 008 500", "+34 667 008 500",
 * "0034667008500", "667-008-500", "(+34) 667008500".
 *
 * Cuando no hay prefijo de país se asume España, que es el único mercado por
 * ahora. Un número extranjero hay que escribirlo con su `+` delante; si no,
 * no hay forma de distinguirlo de uno mal escrito.
 */
export function normalizarTelefono(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Nos quedamos con dígitos y con un único '+' si venía al principio. Un '+'
  // en medio ("34+667…") es un error de tecleo, no un prefijo.
  const bruto = String(raw).trim();
  const empiezaConMas = bruto.startsWith('+');
  const digitos = bruto.replace(/\D/g, '');
  if (!digitos) return null;

  let internacional: string;

  if (empiezaConMas) {
    internacional = digitos;
  } else if (digitos.startsWith('00')) {
    // Prefijo internacional a la europea: 0034… → 34…
    internacional = digitos.slice(2);
  } else if (digitos.length === DIGITOS_ES && INICIO_ES.test(digitos)) {
    // Número español escrito a secas.
    internacional = `34${digitos}`;
  } else if (digitos.startsWith('34') && digitos.length === DIGITOS_ES + 2) {
    // "34667008500" sin '+' ni '00'.
    internacional = digitos;
  } else {
    // Cualquier otra cosa sin prefijo: o está incompleta o no sabemos de qué
    // país es. Preferimos rechazarla a inventarnos un +34 que no llegue.
    return null;
  }

  // Rango de E.164: entre 8 y 15 dígitos contando el código de país, y nunca
  // empezando por 0. Esto es lo que descarta los "6584911" de 7 dígitos que
  // había guardados y a los que WhatsApp nunca llegó.
  if (internacional.length < 8 || internacional.length > 15) return null;
  if (internacional.startsWith('0')) return null;

  return `+${internacional}`;
}

/** ¿Es un teléfono con el que se puede contactar al cliente? */
export function telefonoEsValido(raw: string | null | undefined): boolean {
  return normalizarTelefono(raw) !== null;
}

/**
 * Versión legible para pantalla: `+34 667 008 500`.
 *
 * Solo agrupa los españoles, que son los que se leen de un vistazo en tríos.
 * Para el resto se devuelve el E.164 tal cual, porque cada país agrupa a su
 * manera y agrupar mal se lee peor que no agrupar.
 */
export function formatearTelefono(raw: string | null | undefined): string {
  const e164 = normalizarTelefono(raw);
  if (!e164) return (raw ?? '').trim();

  if (e164.startsWith('+34') && e164.length === 12) {
    const n = e164.slice(3);
    return `+34 ${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
  }
  return e164;
}
