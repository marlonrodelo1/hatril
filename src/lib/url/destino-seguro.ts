/**
 * El `next` de después de identificarse, reducido a una ruta de la casa.
 *
 * EL HUECO QUE CIERRA
 * -------------------
 * Hasta el 20-oct se comprobaba en tres sitios con
 * `next.startsWith('/') && !next.startsWith('//')`, y eso deja pasar
 * `/\evil.com`. El navegador trata la barra invertida como una barra normal en
 * las URL http, así que `new URL('/\\evil.com', base)` da `https://evil.com/`:
 * un enlace con nuestro dominio delante que, después de poner la contraseña,
 * lleva a otro sitio. Es el redirector abierto que el comentario de al lado
 * decía estar evitando.
 *
 * POR QUÉ RESOLVER EN VEZ DE MIRAR EL TEXTO
 * -----------------------------------------
 * Cada comprobación de prefijo se salta con una variante que el analizador de
 * URL normaliza: la barra invertida, un tabulador en medio (`/\t/evil.com`, que
 * el analizador borra), `/.//evil.com` (cuyo pathname resuelto empieza por
 * `//`). En vez de perseguirlas una a una, se le pregunta al mismo analizador
 * que usará el navegador a dónde va de verdad, contra un origen que no existe,
 * y solo se acepta si se queda en ese origen. Lo que se devuelve es lo que él
 * ha resuelto, no lo que llegó.
 *
 * Sin `server-only` a propósito: no toca nada del servidor, y así se puede
 * probar desde un script suelto.
 */

const ORIGEN_FICTICIO = 'https://x.invalid';

// C0, DEL y C1. El analizador de URL borra tabuladores y saltos de línea en
// silencio, que es justo el tipo de cosa que convierte una ruta en otra.
const CONTROL = /[\u0000-\u001F\u007F-\u009F]/;

/**
 * Devuelve la ruta interna (`pathname + search + hash`) o `null` si `valor` no
 * es una ruta de esta aplicación. Quien llama decide el destino por defecto.
 */
export function destinoSeguro(valor: unknown): string | null {
  if (typeof valor !== 'string') return null;
  if (valor === '' || valor.length > 2048) return null;

  // Ruta absoluta y nada más: ni `https://…`, ni `javascript:`, ni relativas
  // como `mi`, que dependerían de la página desde la que se envía.
  if (!valor.startsWith('/')) return null;
  if (valor.includes('\\') || CONTROL.test(valor)) return null;

  let url: URL;
  try {
    url = new URL(valor, ORIGEN_FICTICIO);
  } catch {
    return null;
  }

  if (url.origin !== ORIGEN_FICTICIO) return null;

  // `/.//evil.com` resuelve en este origen con pathname `//evil.com`, y
  // devolverlo tal cual sería una URL sin esquema que el navegador lleva a
  // evil.com. Lo mismo con la barra invertida escrita como `%5C`: aquí es
  // inofensiva, pero no hay ninguna ruta nuestra que la necesite, y cualquier
  // capa que decodifique antes de redirigir la volvería a convertir en `\`.
  let ruta: string;
  try {
    ruta = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  if (url.pathname.startsWith('//') || ruta.startsWith('//')) return null;
  if (ruta.includes('\\') || CONTROL.test(ruta)) return null;

  return url.pathname + url.search + url.hash;
}
