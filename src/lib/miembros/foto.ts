import 'server-only';

import { eq } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';
import { createAdminClient } from '@/lib/supabase/admin';
import { BUCKET, firmarImagenes } from '@/lib/comunidad/imagenes';
import { MAX_BYTES_IMAGEN } from '@/lib/comunidad/limites';

/**
 * La foto de perfil de los miembros: subirla, quitarla y pintarla.
 *
 * VA AL BUCKET PRIVADO, FIRMADA (30-oct)
 * --------------------------------------
 * La cara de un miembro es dato personal —y en una congregación, dato del que
 * se deduce su confesión religiosa—, así que no puede servirse desde un bucket
 * público con una URL permanente. Va al mismo bucket privado que las fotos del
 * muro (`comunidad`), bajo `perfiles/<iglesia>/`, y `foto_url` guarda la RUTA,
 * no una URL: la URL firmada caduca en una hora y se pide al pintar.
 *
 * Y LAS QUE YA ERAN URL SIGUEN VALIENDO
 * -------------------------------------
 * Las fotos de la demo son URLs de `randomuser.me`, de antes de esto. Una
 * `foto_url` que empieza por `http` se pinta tal cual; una ruta se firma. Así no
 * hace falta migrar nada, y las nuevas nacen privadas.
 *
 * Lo que pinte una foto de miembro tiene que pasar por `fotosParaPintar`: una
 * ruta sin firmar en un `<img>` no se ve, y no da ningún error que lo avise.
 */

const TIPOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const esRuta = (v: string) => !/^https?:\/\//i.test(v);

/**
 * De lo que guarda `foto_url` a lo que se puede poner en un `<img>`.
 *
 * Una sola llamada a Storage para toda la pantalla: se le pasan todas las fotos
 * que se van a pintar y devuelve un mapa de valor guardado a URL pintable.
 */
export async function fotosParaPintar(
  valores: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unicos = [...new Set(valores.filter((v): v is string => Boolean(v)))];
  const firmas = await firmarImagenes(unicos.filter(esRuta));

  const mapa = new Map<string, string>();
  for (const v of unicos) {
    const url = esRuta(v) ? firmas.get(v) : v;
    if (url) mapa.set(v, url);
  }
  return mapa;
}

/** Para un solo valor. Con muchos, `fotosParaPintar` de una vez. */
export async function fotoParaPintar(
  valor: string | null | undefined,
): Promise<string | null> {
  if (!valor) return null;
  return (await fotosParaPintar([valor])).get(valor) ?? null;
}

/**
 * La foto de perfil de quien está mirando, ya pintable.
 *
 * Vive aquí y no en el contexto de usuario: ese contexto lo pide cada pantalla
 * y la foto solo la necesitan el compositor del muro, la cabecera y Mi cuenta.
 * Devuelve null sin ficha, que es el caso de quien tiene acceso y todavía no
 * ha sido dado de alta en el fichero de la congregación.
 */
export async function miFotoDePerfil(ctx: UserContext): Promise<string | null> {
  return fotoParaPintar(await miFotoGuardada(ctx));
}

async function miFotoGuardada(ctx: UserContext): Promise<string | null> {
  if (!ctx.miembroId) return null;

  const filas = await withUser(ctx.user.id, (tx) =>
    tx
      .select({ fotoUrl: miembros.fotoUrl })
      .from(miembros)
      .where(eq(miembros.id, ctx.miembroId!))
      .limit(1),
  );

  return filas[0]?.fotoUrl ?? null;
}

export type ResultadoFoto = { ok: true } | { ok: false; error: string };

/**
 * Subir la foto propia. Sustituye a la anterior y borra su fichero.
 *
 * La fila se toca por `withUser`, la misma puerta que «Tus datos»: la policy de
 * `miembros` deja a cada cual cambiar su propia ficha. Storage va con el
 * service role porque el bucket es privado y no tiene policies para
 * `authenticated`; la ruta la decide el servidor, nunca el formulario.
 */
export async function subirMiFoto(ctx: UserContext, fichero: File): Promise<ResultadoFoto> {
  if (!ctx.miembroId) {
    return { ok: false, error: 'Todavía no tienes ficha en la iglesia, así que no hay dónde poner la foto.' };
  }
  if (fichero.size === 0) return { ok: false, error: 'Elige una foto.' };
  if (fichero.size > MAX_BYTES_IMAGEN) {
    return { ok: false, error: 'La foto pesa más de 5 MB. Redúcela y vuelve a intentarlo.' };
  }
  const extension = TIPOS[fichero.type];
  if (!extension) return { ok: false, error: 'Solo se admiten fotos JPG, PNG o WebP.' };

  const anterior = await miFotoGuardada(ctx);
  // Con la hora en el nombre: si fuera siempre el mismo, la URL firmada de
  // antes seguiría enseñando la foto vieja hasta caducar.
  const ruta = `perfiles/${ctx.iglesia.id}/${ctx.miembroId}-${Date.now().toString(36)}.${extension}`;

  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(ruta, fichero, { contentType: fichero.type, upsert: false });
  if (error) {
    console.error('[perfil] subida fallida', { ruta, error });
    return { ok: false, error: 'No se pudo guardar la foto. Prueba otra vez.' };
  }

  const cambiadas = await withUser(ctx.user.id, (tx) =>
    tx
      .update(miembros)
      .set({ fotoUrl: ruta })
      .where(eq(miembros.id, ctx.miembroId!))
      .returning({ id: miembros.id }),
  );

  if (cambiadas.length === 0) {
    // La policy no le dejó tocar su ficha: el fichero subido no sirve de nada.
    await supabase.storage.from(BUCKET).remove([ruta]);
    return { ok: false, error: 'No se pudo guardar la foto en tu ficha.' };
  }

  if (anterior && esRuta(anterior)) await supabase.storage.from(BUCKET).remove([anterior]);
  return { ok: true };
}

/** Quitar la foto propia: vuelven las iniciales. */
export async function quitarMiFoto(ctx: UserContext): Promise<ResultadoFoto> {
  if (!ctx.miembroId) return { ok: true };
  const anterior = await miFotoGuardada(ctx);

  await withUser(ctx.user.id, (tx) =>
    tx.update(miembros).set({ fotoUrl: null }).where(eq(miembros.id, ctx.miembroId!)),
  );

  if (anterior && esRuta(anterior)) {
    await createAdminClient().storage.from(BUCKET).remove([anterior]);
  }
  return { ok: true };
}
