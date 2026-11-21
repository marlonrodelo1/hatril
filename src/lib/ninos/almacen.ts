import 'server-only';

import { randomUUID } from 'node:crypto';

import { createAdminClient } from '@/lib/supabase/admin';
import type { TipoArchivoNino } from '@/lib/db/schema';

/**
 * Los dos buckets del drive de Niños (`0060`): privados y sin una sola policy.
 *
 * EL NAVEGADOR NO LEE NI SUBE NADA POR SU CUENTA
 * ----------------------------------------------
 * Igual que el bucket `comunidad`: la API de Storage opera con el rol del JWT,
 * no con `hatril_app`, así que todo pasa por el service role DESPUÉS de que la
 * action o la página hayan comprobado quién es por `withUser()`.
 *
 * Con una diferencia: la subida. Un vídeo de 100 MB por una server action
 * obligaría a subir su límite de cuerpo y a pasarlo entero por el VPS. Así que
 * el servidor apunta la fila, pide a Storage una URL de subida de UN SOLO USO
 * para esa ruta exacta, y el teléfono sube con ella. `authenticated` sigue sin
 * ningún permiso: el token vale para un fichero y una ruta que ya están
 * apuntados en `ninos_archivos`, y la ruta empieza por la carpeta de esa
 * iglesia y ese ministerio (HT142).
 */

export const BUCKETS: Record<TipoArchivoNino, string> = {
  foto: 'ninos-fotos',
  video: 'ninos-videos',
};

/** Las miniaturas, de fotos y de vídeos, viven con las fotos. */
const BUCKET_MINIATURAS = BUCKETS.foto;

/**
 * Diez minutos. Lo justo para que la página pinte y se mire: una URL firmada
 * que se escapa (una captura del inspector, un enlace pegado en un chat) deja
 * de valer enseguida. Son fotos de niños.
 */
export const SEGUNDOS_FIRMA = 600;

const EXTENSIONES: Record<string, string> = {
  'image/webp': 'webp',
  'image/jpeg': 'jpg',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** La extensión de un tipo admitido, o `null` si el bucket lo rechazaría. */
export function extensionDe(tipoMime: string): string | null {
  return EXTENSIONES[tipoMime] ?? null;
}

/**
 * La ruta de un fichero nuevo: `<iglesia>/<ministerio>/<fecha>/<uuid>.<ext>`.
 *
 * El nombre lo pone el servidor y es aleatorio: el del teléfono
 * («IMG_2041_Sofia_cumple.jpg») puede llevar el nombre de un niño.
 */
export function rutaNueva(
  iglesiaId: string,
  ministerioId: string,
  fecha: string,
  extension: string,
): { ruta: string; miniatura: string } {
  const base = `${iglesiaId}/${ministerioId}/${fecha}/${randomUUID()}`;
  return { ruta: `${base}.${extension}`, miniatura: `${base}.min.webp` };
}

export type SubidaFirmada = { ruta: string; token: string };

/**
 * Las URL de subida de un solo uso: la del fichero y, si va, la de su miniatura.
 * Sin `upsert`: un token no puede pisar un fichero que ya existe.
 */
export async function firmarSubida(
  tipo: TipoArchivoNino,
  ruta: string,
  miniatura: string | null,
): Promise<{ fichero: SubidaFirmada; miniatura: SubidaFirmada | null } | null> {
  const admin = createAdminClient();

  const f = await admin.storage.from(BUCKETS[tipo]).createSignedUploadUrl(ruta);
  if (f.error || !f.data) return null;

  let m: SubidaFirmada | null = null;
  if (miniatura) {
    const r = await admin.storage.from(BUCKET_MINIATURAS).createSignedUploadUrl(miniatura);
    if (r.error || !r.data) return null;
    m = { ruta: miniatura, token: r.data.token };
  }

  return { fichero: { ruta, token: f.data.token }, miniatura: m };
}

/**
 * ¿Está el fichero en Storage, y es lo que se apuntó?
 *
 * Es la confirmación que hace visible un archivo (`confirmado_at`). Se mira el
 * tamaño contra el apuntado —con margen: el teléfono redondea— y el tipo, que
 * el bucket ya filtra pero que aquí se lee de lo que de verdad se guardó.
 */
export async function comprobarFichero(
  tipo: TipoArchivoNino,
  ruta: string,
): Promise<{ bytes: number; tipoMime: string } | null> {
  const admin = createAdminClient();
  const { data, error } = await admin.storage.from(BUCKETS[tipo]).info(ruta);
  if (error || !data) return null;
  return {
    bytes: Number(data.size ?? 0),
    tipoMime: String(data.contentType ?? ''),
  };
}

/** URL firmadas de diez minutos, por ruta. Las que fallan, no salen. */
export async function firmarLectura(
  tipo: TipoArchivoNino | 'miniatura',
  rutas: string[],
): Promise<Map<string, string>> {
  const salida = new Map<string, string>();
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (unicas.length === 0) return salida;

  const bucket = tipo === 'miniatura' ? BUCKET_MINIATURAS : BUCKETS[tipo];
  const { data, error } = await createAdminClient()
    .storage.from(bucket)
    .createSignedUrls(unicas, SEGUNDOS_FIRMA);
  if (error || !data) return salida;

  for (const fila of data) {
    if (fila.path && fila.signedUrl && !fila.error) salida.set(fila.path, fila.signedUrl);
  }
  return salida;
}

/**
 * Borra ficheros del bucket. Se llama DESPUÉS de borrar sus filas: si Storage
 * falla, queda un fichero huérfano que el cron recogerá (fase N3), y no una
 * fila que apunta a la nada y que el tablón intentaría pintar.
 */
export async function borrarFicheros(
  tipo: TipoArchivoNino | 'miniatura',
  rutas: string[],
): Promise<void> {
  const unicas = [...new Set(rutas.filter(Boolean))];
  if (unicas.length === 0) return;
  const bucket = tipo === 'miniatura' ? BUCKET_MINIATURAS : BUCKETS[tipo];
  await createAdminClient().storage.from(bucket).remove(unicas);
}
