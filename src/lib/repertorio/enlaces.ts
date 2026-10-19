import { z } from 'zod';

/**
 * Los enlaces de una canción: dónde escucharla y dónde están sus acordes.
 *
 * SOLO `http(s)://`, Y POR QUÉ IMPORTA AQUÍ
 * -----------------------------------------
 * Un enlace guardado se pinta como `<a href>` en el móvil de cada músico del
 * equipo. Un `javascript:` pegado ahí sería código ejecutándose en la sesión de
 * otra persona con un clic. Lo comprueba Zod para dar el mensaje y un CHECK de
 * la `0039` para que una action olvidada no lo escriba igual.
 *
 * Sin `server-only`: lo usan las actions y las pantallas.
 */

/**
 * Lo que la gente pega, a una dirección completa.
 *
 * Se copia «youtube.com/watch?v=…» sin el `https://` delante, y rechazarlo con
 * un error sería pedirle a alguien que escriba algo que el navegador da por
 * hecho. Si parece un dominio, se le pone delante; si no, se deja tal cual y
 * la validación dirá que no vale.
 */
export function normalizarEnlace(valor: string | undefined): string | undefined {
  const limpio = valor?.trim();
  if (!limpio) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(limpio)) return limpio;
  if (/^[\w-]+(\.[\w-]+)+([/?#]|$)/.test(limpio)) return `https://${limpio}`;
  return limpio;
}

export function esEnlaceWeb(valor: string): boolean {
  try {
    const u = new URL(valor);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Un enlace opcional: vacío, o una dirección web entera de hasta 500. */
export const EsquemaEnlace = z
  .string()
  .max(500, 'Ese enlace es demasiado largo.')
  .refine(esEnlaceWeb, 'Pega la dirección entera del enlace, la que empieza por https://')
  .optional();

/**
 * «youtube.com», para que quien pulse sepa a dónde va antes de pulsar.
 *
 * Un botón que dice «Escuchar» y abre una web desconocida es justo cómo se
 * cuela un enlace raro en un grupo de iglesia. Con el sitio a la vista, el
 * músico ve si es el YouTube de siempre.
 */
export function sitioDe(enlace: string): string {
  try {
    return new URL(enlace).hostname.replace(/^www\./, '');
  } catch {
    return enlace;
  }
}
