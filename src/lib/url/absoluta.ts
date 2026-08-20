/**
 * Las direcciones que una iglesia comparte con su gente.
 *
 * POR QUÉ NO SE CONSTRUYEN A MANO EN CADA PANTALLA
 * ------------------------------------------------
 * Hasta ahora todas las rutas del producto eran relativas (`/i/${slug}`), que
 * vale para navegar y no vale para pegar en un grupo de WhatsApp. En cuanto hay
 * que producir una dirección absoluta aparecen dos reglas que no son evidentes y
 * que si se replican en cinco sitios se olvidan en tres.
 *
 * El origen se pasa como parámetro en vez de leerlo aquí: `getOrigin()` usa
 * `headers()`, y llamarlo desde una página con ISR la volvería dinámica. Quien
 * llama sabe si puede.
 */

/** Lo mínimo que hace falta saber de la iglesia para componer sus enlaces. */
export type IglesiaEnlazable = {
  slug: string;
  dominioPropio?: string | null;
};

/**
 * La web pública de la iglesia.
 *
 * Si la congregación tiene dominio propio, ese es el enlace que comparte: lo ha
 * pagado y el proxy sirve su web en la raíz, sin redirigir, para que lo siga
 * viendo en la barra del navegador.
 */
export function urlPublicaIglesia(
  iglesia: IglesiaEnlazable,
  origen: string,
): string {
  if (iglesia.dominioPropio) {
    return `https://${iglesia.dominioPropio}`;
  }
  return `${origen}/i/${iglesia.slug}`;
}

/**
 * El formulario para pedir unirse a la congregación.
 *
 * SIEMPRE por el dominio de Hatril, aunque la iglesia tenga el suyo. No es un
 * descuido: el proxy reescribe **todo** lo que llega por un dominio propio a
 * `/i/<slug>/<lo que venga>`, así que `midominio.es/solicitar/betania` acabaría
 * en `/i/betania/solicitar/betania`, que no existe. El día que solicitar tenga
 * que vivir bajo el dominio de la iglesia, la ruta a crear es
 * `/i/[slug]/solicitar` y este comentario es el aviso.
 */
export function urlSolicitar(iglesia: IglesiaEnlazable, origen: string): string {
  return `${origen}/solicitar/${iglesia.slug}`;
}

/**
 * Abrir WhatsApp con el mensaje escrito, para que solo haya que elegir a quién.
 *
 * Sin número: `wa.me` sin destinatario abre el selector de contactos, que es lo
 * que hace falta cuando lo que se quiere es repartir el enlace por los grupos de
 * la iglesia.
 */
export function enlaceWhatsapp(texto: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`;
}
