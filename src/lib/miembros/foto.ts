import 'server-only';

import { eq } from 'drizzle-orm';

import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import type { UserContext } from '@/lib/auth/user-context';

/**
 * La foto de perfil de quien está mirando.
 *
 * VIVE AQUÍ Y NO EN EL CONTEXTO DE USUARIO
 * ----------------------------------------
 * Podría ser una columna más del `select` de `getCurrentUserContext()`, que ya
 * lee `miembros`. Se deja fuera porque ese contexto lo pide CADA pantalla del
 * panel y de `/mi` —cuarenta al día por persona— y la foto solo la necesitan el
 * compositor del muro y el menú de la cuenta. Un dato que casi nadie usa no
 * viaja en la consulta que usa todo el mundo.
 *
 * Y VIVE EN `miembros/` Y NO EN `comunidad/`
 * ------------------------------------------
 * Nació dentro de las consultas del muro, que es donde primero hizo falta. En
 * cuanto la pidió también la cabecera —que se pinta en el panel, donde no hay
 * muro ninguno— se mudó aquí: una cabecera del panel importando de
 * `lib/comunidad` es la clase de dependencia que luego nadie entiende.
 *
 * Devuelve null sin ficha, que es el caso de quien tiene acceso y todavía no ha
 * sido dado de alta en el fichero de la congregación.
 *
 * HOY LA URL ES PÚBLICA, Y NO PUEDE SEGUIR ASÍ
 * --------------------------------------------
 * `foto_url` guarda una URL del bucket público. Para la demo vale; para
 * producción no: la cara de un miembro es dato personal —y en una congregación,
 * dato del que se deduce su confesión religiosa—. Tiene que ir al bucket privado
 * y firmarse aquí, exactamente como hace `firmarImagenes()` con las fotos del
 * muro. Cuando eso pase, esta función es el único sitio que cambia.
 */
export async function miFotoDePerfil(ctx: UserContext): Promise<string | null> {
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
