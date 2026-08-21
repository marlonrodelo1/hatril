import 'server-only';

import { cache } from 'react';
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
    ciudad: string | null;
    pais: string;
    timezone: string;
    moneda: string;
    plan: string;
    trialUntil: Date | null;
    stripeSubscriptionId: string | null;
    logoUrl: string | null;
    /** Para poder ofrecer el enlace a su web solo cuando existe de verdad. */
    webPublica: boolean;
    /**
     * Cómo tiene configurado el muro.
     *
     * Viaja en el contexto y no en una consulta aparte porque lo necesitan tres
     * pantallas —el muro, su configuración y la web pública— y las columnas ya
     * vienen en el mismo `select` de `iglesias` que se hace aquí de todas
     * formas. Pedirlo suelto serían tres viajes más para cuatro booleanos.
     *
     * Ojo: esto sirve para decidir QUÉ SE PINTA. Lo que impide de verdad
     * publicar con el muro apagado son las policies de la `0027`.
     */
    comunidad: {
      activa: boolean;
      quienPublica: 'todos' | 'equipo' | 'pastor';
      comentarios: boolean;
      fotos: boolean;
    };
  };
  rol: RolIglesia;
  permisos: MapaPermisos;
  /** Ficha de miembro de esta persona. Null si todavía no tiene. */
  miembroId: string | null;
  /** Ministerios en los que sirve. Define su ámbito si no ve la iglesia entera. */
  ministerioIds: string[];
  /**
   * Aquellos donde además es responsable o colíder. Es lo que acota
   * `gestionar_su_ministerio`: sin esto, ese permiso no significaría nada.
   */
  ministeriosQueLidera: string[];
};

/**
 * Devuelve el contexto, o `null` si no hay sesión o la sesión no pertenece a
 * ninguna iglesia con membresía ACTIVA.
 *
 * No redirige: para eso están los guards de `guard-panel.ts`. Esta función se
 * usa cuando hay que decidir qué pintar sin echar a nadie (por ejemplo, si
 * enseñar el enlace al panel desde la web pública).
 *
 * ENVUELTA EN `cache()` DE REACT
 * ------------------------------
 * Dentro de un mismo render la piden ahora tres capas —el layout del panel para
 * el menú, la cabecera de la página para la campana y el menú de cuenta, y la
 * propia página para sus datos— y cada llamada eran tres viajes a Postgres más
 * el `getUser()` de Supabase. Con `cache()` se ejecuta una vez y las demás
 * reciben la misma promesa.
 *
 * Ojo con el matiz: `cache()` deduplica DENTRO de un render de servidor, nunca
 * entre peticiones ni entre personas. No es un caché de datos, no hay nada que
 * invalidar, y no puede devolverle a alguien el contexto de otro.
 */
export const getCurrentUserContext = cache(async function getCurrentUserContext(): Promise<UserContext | null> {
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
      ciudad: iglesias.ciudad,
      pais: iglesias.pais,
      timezone: iglesias.timezone,
      moneda: iglesias.moneda,
      plan: iglesias.plan,
      trialUntil: iglesias.trialUntil,
      stripeSubscriptionId: iglesias.stripeSubscriptionId,
      logoUrl: iglesias.logoUrl,
      webPublica: iglesias.webPublica,
      comunidadActiva: iglesias.comunidadActiva,
      comunidadQuienPublica: iglesias.comunidadQuienPublica,
      comunidadComentarios: iglesias.comunidadComentarios,
      comunidadFotos: iglesias.comunidadFotos,
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
        .select({
          ministerioId: ministerioMiembros.ministerioId,
          // Del MISMO viaje. Saber cuáles lidera no cuesta una consulta más:
          // cuesta una columna, y las filas ya venían.
          rolEquipo: ministerioMiembros.rolEquipo,
        })
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
      ciudad: fila.ciudad,
      pais: fila.pais,
      timezone: fila.timezone,
      moneda: fila.moneda,
      plan: fila.plan,
      trialUntil: fila.trialUntil,
      stripeSubscriptionId: fila.stripeSubscriptionId,
      logoUrl: fila.logoUrl,
      webPublica: fila.webPublica,
      comunidad: {
        activa: fila.comunidadActiva,
        quienPublica: fila.comunidadQuienPublica,
        comentarios: fila.comunidadComentarios,
        fotos: fila.comunidadFotos,
      },
    },
    rol: fila.rol,
    permisos: resolverPermisos(fila.rol, fila.permisos),
    miembroId: fila.miembroId,
    ministerioIds: ministerios.map((m) => m.ministerioId),
    ministeriosQueLidera: ministerios
      .filter((m) => m.rolEquipo !== 'voluntario')
      .map((m) => m.ministerioId),
  };
});

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
