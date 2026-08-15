import 'server-only';

import { and, eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

import { dbAdmin } from '@/lib/db';
import { iglesias, iglesiaUsuarios, ministerioMiembros } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import {
  resolverPermisos,
  type MapaPermisos,
  type RolIglesia,
} from '@/lib/auth/permisos';

/**
 * Quién está usando el panel ahora mismo, y qué puede hacer.
 *
 * Es la pieza que cualquier página o server action del panel pide primero. Todo
 * lo demás —los guards, el ámbito de miembros, qué se pinta en el menú— sale de
 * aquí.
 *
 * POR QUÉ `dbAdmin` PARA ESTA CONSULTA CONCRETA
 * ---------------------------------------------
 * Es la excepción, y solo esta. Las policies de RLS preguntan por
 * `iglesia_usuarios` para decidir a qué llega cada cual; resolver esa misma
 * tabla con `withUser` sería pedirle a la cerradura que se abra con la llave
 * que está dentro. A partir de este punto, TODO lo demás va por `withUser`.
 *
 * LA IGLESIA NO SE TOMA NUNCA DEL CLIENTE
 * ---------------------------------------
 * Ni de un parámetro, ni de una cabecera, ni de la URL. Sale de la sesión a
 * través de `iglesia_usuarios`. Es la regla de oro que Gonper documenta en su
 * `guard-panel.ts` y la razón de que un id de iglesia en la URL no sirva de
 * nada para colarse en otra congregación.
 */

export type UserContext = {
  user: User;
  iglesia: {
    id: string;
    slug: string;
    nombre: string;
    timezone: string;
    moneda: string;
    plan: string;
    trialUntil: Date | null;
    stripeSubscriptionId: string | null;
    logoUrl: string | null;
  };
  rol: RolIglesia;
  permisos: MapaPermisos;
  /** Ficha de miembro de esta persona. Null si todavía no tiene. */
  miembroId: string | null;
  /** Ministerios en los que sirve. Define su ámbito si no ve la iglesia entera. */
  ministerioIds: string[];
};

/**
 * Devuelve el contexto, o `null` si no hay sesión o la sesión no pertenece a
 * ninguna iglesia con membresía ACTIVA.
 *
 * No redirige: para eso están los guards de `guard-panel.ts`. Esta función se
 * usa cuando hay que decidir qué pintar sin echar a nadie (por ejemplo, si
 * enseñar el enlace al panel desde la web pública).
 */
export async function getCurrentUserContext(): Promise<UserContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const filas = await dbAdmin
    .select({
      rol: iglesiaUsuarios.rol,
      permisos: iglesiaUsuarios.permisos,
      miembroId: iglesiaUsuarios.miembroId,
      iglesiaId: iglesias.id,
      slug: iglesias.slug,
      nombre: iglesias.nombre,
      timezone: iglesias.timezone,
      moneda: iglesias.moneda,
      plan: iglesias.plan,
      trialUntil: iglesias.trialUntil,
      stripeSubscriptionId: iglesias.stripeSubscriptionId,
      logoUrl: iglesias.logoUrl,
    })
    .from(iglesiaUsuarios)
    .innerJoin(iglesias, eq(iglesias.id, iglesiaUsuarios.iglesiaId))
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, user.id),
        // `activo` y no la simple existencia de la fila: quien solicitó entrar
        // por el directorio está 'pendiente' y NO tiene contexto de iglesia.
        // Es la misma condición que exige `pertenece_a_iglesia()` en las
        // policies; si las dos se separaran, la aplicación enseñaría un panel
        // que la base de datos devuelve vacío.
        eq(iglesiaUsuarios.estado, 'activo'),
        eq(iglesias.activa, true),
      ),
    )
    .limit(1);

  const fila = filas[0];
  if (!fila) return null;

  // Los ministerios en los que sirve. Solo hace falta si NO ve la congregación
  // entera, pero se resuelve siempre: son dos consultas por render de panel, y
  // hacerlo condicional obligaría a cada llamante a saber si le toca pedirlo.
  const ministerios = fila.miembroId
    ? await dbAdmin
        .select({ ministerioId: ministerioMiembros.ministerioId })
        .from(ministerioMiembros)
        .where(
          and(
            eq(ministerioMiembros.miembroId, fila.miembroId),
            eq(ministerioMiembros.activo, true),
          ),
        )
    : [];

  return {
    user,
    iglesia: {
      id: fila.iglesiaId,
      slug: fila.slug,
      nombre: fila.nombre,
      timezone: fila.timezone,
      moneda: fila.moneda,
      plan: fila.plan,
      trialUntil: fila.trialUntil,
      stripeSubscriptionId: fila.stripeSubscriptionId,
      logoUrl: fila.logoUrl,
    },
    rol: fila.rol,
    permisos: resolverPermisos(fila.rol, fila.permisos),
    miembroId: fila.miembroId,
    ministerioIds: ministerios.map((m) => m.ministerioId),
  };
}

/**
 * ¿Tiene esta sesión alguna solicitud de ingreso sin resolver?
 *
 * Se pregunta cuando `getCurrentUserContext()` devuelve null pero hay sesión:
 * sirve para distinguir «no perteneces a ninguna iglesia» de «tu solicitud está
 * en revisión», que para la persona son situaciones muy distintas y merecen
 * pantallas distintas.
 */
export async function getMembresiaPendiente(authUserId: string): Promise<{
  iglesiaNombre: string;
  iglesiaSlug: string;
} | null> {
  const filas = await dbAdmin
    .select({ nombre: iglesias.nombre, slug: iglesias.slug })
    .from(iglesiaUsuarios)
    .innerJoin(iglesias, eq(iglesias.id, iglesiaUsuarios.iglesiaId))
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, authUserId),
        eq(iglesiaUsuarios.estado, 'pendiente'),
      ),
    )
    .limit(1);

  const fila = filas[0];
  return fila ? { iglesiaNombre: fila.nombre, iglesiaSlug: fila.slug } : null;
}
