import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Subida del logo y la portada de una iglesia.
 *
 * POR QUÉ AQUÍ SÍ VA EL SERVICE ROLE
 * ----------------------------------
 * En el resto del repo la regla es la contraria: se consulta con la sesión y
 * `dbAdmin` es la excepción. Aquí no se puede, y conviene saber por qué antes de
 * «arreglarlo».
 *
 * La API de Storage no pasa por `withUser()`, así que nunca opera como
 * `hatril_app`: usa el rol del JWT, que es `authenticated`. Escribir con el
 * cliente de la sesión exigiría dar permisos de escritura a `authenticated`
 * sobre `storage.objects` — y ese es el rol que el navegador presenta con la
 * publishable key, así que quedaría abierto desde fuera de la aplicación. Es lo
 * que `CLAUDE.md` prohíbe expresamente.
 *
 * QUÉ SUSTITUYE A LA POLICY
 * -------------------------
 * Dos cosas, y las dos están arriba en la cadena:
 *
 *   1. La server action llama a `requirePastorAccion` antes de llegar aquí.
 *   2. `iglesiaId` viene del contexto de servidor, NO del formulario. El cliente
 *      no elige carpeta: aunque manipulara el envío, no hay campo que tocar.
 *
 * Por eso este módulo no acepta rutas sueltas y solo recibe un id de iglesia y
 * una ranura de un conjunto cerrado.
 */

export const BUCKET = 'iglesias-publico';

/** 2 MB, el mismo tope que declara el bucket. Aquí para dar un mensaje decente. */
const MAX_BYTES = 2 * 1024 * 1024;

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export type Ranura = 'logo' | 'banner' | 'foto';

export type ResultadoSubida =
  | { ok: true; url: string }
  | { ok: false; error: string };

/**
 * Sube una imagen y devuelve su URL pública.
 *
 * El nombre lleva un sufijo que cambia en cada subida. Sin él, la URL sería
 * siempre la misma y el navegador —y la CDN— seguirían enseñando la imagen
 * vieja después de cambiarla: el clásico «lo he subido y no se ve». Se pasa
 * desde fuera para no usar `Date.now()` aquí dentro.
 */
export async function subirImagenIglesia(
  iglesiaId: string,
  ranura: Ranura,
  fichero: File,
  sufijo: string,
): Promise<ResultadoSubida> {
  if (fichero.size === 0) {
    return { ok: false, error: 'No has elegido ninguna imagen.' };
  }

  if (fichero.size > MAX_BYTES) {
    return {
      ok: false,
      error: 'La imagen pesa más de 2 MB. Redúcela y vuelve a intentarlo.',
    };
  }

  const extension = TIPOS[fichero.type];
  if (!extension) {
    return {
      ok: false,
      error: 'Solo se admiten imágenes JPG, PNG o WebP.',
    };
  }

  const supabase = createAdminClient();
  const ruta = `${iglesiaId}/${ranura}-${sufijo}.${extension}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, fichero, { contentType: fichero.type, upsert: true });

  if (error) {
    // El mensaje de Storage viene en inglés y habla de buckets y policies. No
    // se le enseña a un pastor: se traduce y el original queda en el servidor.
    console.error('[storage] subida fallida', { ruta, error });
    return {
      ok: false,
      error: 'No se pudo guardar la imagen. Inténtalo otra vez.',
    };
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(ruta);
  return { ok: true, url: data.publicUrl };
}

/**
 * Borra la imagen anterior, si la había.
 *
 * Se hace DESPUÉS de que la nueva esté guardada y nunca antes: si se borrara
 * primero y la subida fallara, la iglesia se quedaría sin logo por intentar
 * cambiarlo. Y si el borrado falla, no se dice nada — queda un fichero huérfano
 * de unos kilobytes, que es mejor que un error en la cara por algo que a nadie
 * le importa.
 */
export async function borrarImagenAnterior(urlAnterior: string | null) {
  if (!urlAnterior) return;

  const marca = `/${BUCKET}/`;
  const i = urlAnterior.indexOf(marca);
  if (i === -1) return;

  const ruta = urlAnterior.slice(i + marca.length);
  if (!ruta) return;

  const supabase = createAdminClient();
  await supabase.storage.from(BUCKET).remove([ruta]);
}
