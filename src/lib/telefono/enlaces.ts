/**
 * Los enlaces para llamar a alguien y para abrirle un chat de WhatsApp.
 *
 * Vivían a medias: el de WhatsApp era una función privada de la ficha del
 * seguimiento, y el de llamar se escribía a mano en cada pantalla. Salen aquí
 * el 23-nov, cuando las células los necesitan también (lo pidió Marlon: que el
 * líder pueda llamar y escribir a la gente de su célula).
 *
 * Sin `server-only` y sin base de datos: los usan vistas que pinta también la
 * app empaquetada.
 */

/**
 * `tel:` con el número tal como esté guardado, sin adornos. Vale cualquiera que
 * tenga cifras: `normalizarTelefono` deja como se escribió lo que no reconoce,
 * y un número raro pero anotado sirve para llamar.
 */
export function enlaceLlamar(telefono: string | null | undefined): string | null {
  const limpio = (telefono ?? '').replace(/[^\d+]/g, '');
  return /\d{6,}/.test(limpio) ? `tel:${limpio}` : null;
}

/**
 * El chat de WhatsApp con esa persona, o `null` si el número no está en
 * internacional.
 *
 * `wa.me` quiere el número con su prefijo y sin el más, igual que en
 * `iglesias/redes.ts`. Un teléfono que `normalizarTelefono` no supo poner en
 * E.164 se queda sin botón: adivinarle el país abriría el chat de otra persona.
 */
export function enlaceWhatsappA(telefono: string | null | undefined, texto?: string): string | null {
  if (!telefono?.startsWith('+')) return null;
  const digitos = telefono.slice(1).replace(/\D/g, '');
  if (digitos.length < 8) return null;
  return `https://wa.me/${digitos}${texto ? `?text=${encodeURIComponent(texto)}` : ''}`;
}

/**
 * WhatsApp con el mensaje ya escrito y sin destinatario: abre el selector, y
 * ahí se elige el grupo de la célula o a varias personas.
 *
 * Es lo que hay. WhatsApp no deja mandar un mensaje a varios números desde
 * fuera de la aplicación sin su API de pago, así que «escribir a toda la
 * célula» es escribirlo aquí y mandarlo al grupo que la célula ya tiene.
 */
export function enlaceWhatsappConTexto(texto: string): string {
  return `https://wa.me/?text=${encodeURIComponent(texto)}`;
}
