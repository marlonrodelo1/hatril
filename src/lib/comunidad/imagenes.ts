import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { MAX_BYTES_IMAGEN, MAX_IMAGENES } from './limites';

export { MAX_IMAGENES };

/**
 * Las fotos del muro, en un bucket PRIVADO.
 *
 * EN QUÉ SE DIFERENCIA DE `lib/iglesias/imagenes.ts`
 * --------------------------------------------------
 * Aquel sube al bucket `iglesias-publico` y devuelve una URL permanente: son el
 * logo y la fachada, y salen en la web abierta. Aquí sale gente, con frecuencia
 * menores, así que el bucket es privado y cada visita necesita una URL firmada
 * que caduca. Sin firma, la foto no se abre ni sabiendo la ruta.
 *
 * POR ESO SE GUARDA LA RUTA Y NO LA URL
 * -------------------------------------
 * En la fila queda `iglesia/publicacion/fichero.jpg`. Guardar la URL firmada
 * sería guardar algo que dentro de una hora ya no abre nada, y habría que
 * reescribir la publicación cada vez que alguien la mira.
 *
 * EL SERVICE ROLE, IGUAL QUE EN EL OTRO
 * -------------------------------------
 * Y por el mismo motivo, que la 0009 aprendió a base de fallos: la API de
 * Storage no pasa por `withUser()`, opera con el rol del JWT. Darle escritura a
 * `authenticated` abriría el bucket a cualquiera con la publishable key. El
 * navegador no habla con Storage: habla con una server action que ya ha
 * comprobado quién es, y la ruta la construye el servidor con el `iglesia_id`
 * del contexto — el cliente no elige carpeta.
 */

export const BUCKET = 'comunidad';

/**
 * Una hora. Lo que dura mirar el muro sin recargar, y poco suficiente para que
 * una URL copiada y pegada por ahí deje de servir enseguida.
 */
const SEGUNDOS_FIRMA = 3600;

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type ResultadoSubida =
  | { ok: true; rutas: string[] }
  | { ok: false; error: string };

/**
 * Sube las fotos de una publicación y devuelve sus rutas.
 *
 * Si una falla, no se sube ninguna: media publicación con la mitad de las fotos
 * que alguien eligió es peor que un error claro.
 */
export async function subirImagenesPublicacion(
  iglesiaId: string,
  publicacionId: string,
  ficheros: File[],
  sufijo: string,
): Promise<ResultadoSubida> {
  const utiles = ficheros.filter((f) => f.size > 0);
  if (utiles.length === 0) return { ok: true, rutas: [] };

  if (utiles.length > MAX_IMAGENES) {
    return {
      ok: false,
      error: `Puedes subir hasta ${MAX_IMAGENES} fotos en una publicación.`,
    };
  }

  for (const f of utiles) {
    if (f.size > MAX_BYTES_IMAGEN) {
      return {
        ok: false,
        error: 'Alguna foto pesa más de 5 MB. Redúcela y vuelve a intentarlo.',
      };
    }
    if (!TIPOS[f.type]) {
      return { ok: false, error: 'Solo se admiten fotos JPG, PNG o WebP.' };
    }
  }

  const supabase = createAdminClient();
  const rutas: string[] = [];

  for (const [i, fichero] of utiles.entries()) {
    const ruta = `${iglesiaId}/${publicacionId}/${sufijo}-${i}.${TIPOS[fichero.type]}`;

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, fichero, { contentType: fichero.type, upsert: true });

    if (error) {
      // El mensaje de Storage viene en inglés y habla de buckets y policies.
      // Queda en el servidor; fuera va uno que se entienda.
      console.error('[comunidad] subida fallida', { ruta, error });
      if (rutas.length > 0) {
        await supabase.storage.from(BUCKET).remove(rutas);
      }
      return { ok: false, error: 'No se pudieron guardar las fotos. Prueba otra vez.' };
    }

    rutas.push(ruta);
  }

  return { ok: true, rutas };
}

/**
 * Convierte rutas en URLs que el navegador puede abrir, durante una hora.
 *
 * En una sola llamada para todo el muro: `createSignedUrls` firma un lote, y
 * pedir una firma por foto serían treinta viajes a Irlanda para pintar una
 * pantalla.
 */
export async function firmarImagenes(
  rutas: string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  if (rutas.length === 0) return mapa;

  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(rutas, SEGUNDOS_FIRMA);

  if (error || !data) {
    console.error('[comunidad] no se pudieron firmar las imágenes', error);
    return mapa;
  }

  for (const fila of data) {
    // `path` viene con la ruta pedida; si una falló, `signedUrl` es null y esa
    // foto simplemente no se pinta. Mejor un hueco que una pantalla en blanco.
    if (fila.path && fila.signedUrl) mapa.set(fila.path, fila.signedUrl);
  }

  return mapa;
}

/** Borra las fotos de una publicación que se elimina. */
export async function borrarImagenes(rutas: string[]) {
  if (rutas.length === 0) return;
  const supabase = createAdminClient();
  // Si falla, quedan unos kilobytes huérfanos. No se le cuenta a nadie: el
  // borrado de la publicación ya ha ocurrido y es lo que importaba.
  await supabase.storage.from(BUCKET).remove(rutas);
}
