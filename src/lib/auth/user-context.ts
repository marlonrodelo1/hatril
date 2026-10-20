import 'server-only';

import { cache } from 'react';
import { and, asc, eq } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

import { dbAdmin } from '@/lib/db';
import {
  iglesias,
  iglesiaUsuarios,
  ministerioMiembros,
  ministerios,
} from '@/lib/db/schema';
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
    /**
     * Las herramientas de la iglesia que el pastor ha apagado
     * (`iglesias.modulos`). Se lee con `lib/iglesias/herramientas.ts`, nunca a
     * mano: aquí una clave ausente significa ENCENDIDA.
     *
     * En el contexto y no en una consulta aparte por lo mismo que `comunidad`:
     * lo necesitan el menú, Inicio y cada guarda de Finanzas, y la columna ya
     * viene en el mismo `select`.
     */
    modulos: unknown;
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
  /**
   * Los mismos que `ministeriosQueLidera`, con lo que hace falta para pintarlos
   * en el bloque «Lo que llevas» del menú.
   *
   * Aparte, y no en lugar de la lista de ids, porque `ContextoPermisos` es
   * estructural: cualquier contexto futuro lo cumple con tres listas de ids, y
   * obligarle a traer nombres y colores para decidir un permiso mezclaría qué
   * se puede con qué se pinta.
   */
  ministeriosQueLlevo: { id: string; nombre: string; colorHex: string }[];
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
      modulos: iglesias.modulos,
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
    // Con orden, y la membresía más antigua primero. Sin `order by`, Postgres
    // no promete qué fila devuelve un `limit 1`, y una cuenta en dos iglesias
    // —el unique es por pareja, así que la base lo admite— podía caer en una
    // en un clic y en la otra en el siguiente. La más antigua porque es la de
    // casa: que aparezca una segunda membresía, venga de donde venga, no debe
    // cambiarle el panel a nadie sin avisar.
    //
    // El `id` desempata: `now()` es la hora de la transacción, y dos altas
    // hechas en la misma —el seed— comparten `created_at`.
    .orderBy(asc(iglesiaUsuarios.createdAt), asc(iglesiaUsuarios.id))
    .limit(1);

  const fila = filas[0];
  if (!fila) return null;

  // Los ministerios en los que sirve. Solo hace falta si NO ve la congregación
  // entera, pero se resuelve siempre: son dos consultas por render de panel, y
  // hacerlo condicional obligaría a cada llamante a saber si le toca pedirlo.
  const equipos = fila.miembroId
    ? await dbAdmin
        .select({
          ministerioId: ministerioMiembros.ministerioId,
          // Del MISMO viaje. Saber cuáles lidera no cuesta una consulta más:
          // cuesta una columna, y las filas ya venían.
          rolEquipo: ministerioMiembros.rolEquipo,
          // Y por lo mismo el nombre y el color, que pinta el bloque «Lo que
          // llevas» del menú. Pedirlos aparte sería un viaje más en cada carga
          // del panel para dos palabras y un punto.
          nombre: ministerios.nombre,
          colorHex: ministerios.colorHex,
        })
        .from(ministerioMiembros)
        .innerJoin(
          ministerios,
          eq(ministerios.id, ministerioMiembros.ministerioId),
        )
        .where(
          and(
            eq(ministerioMiembros.miembroId, fila.miembroId),
            // Redundante: HT102 no deja colgar de una ficha un ministerio de
            // otra iglesia. Se pone igual porque esto va por `dbAdmin`, sin RLS
            // debajo, y ahora trae NOMBRES que se pintan. Si la coherencia
            // fallara algún día, que no sea enseñando un equipo ajeno.
            eq(ministerioMiembros.iglesiaId, fila.iglesiaId),
            eq(ministerioMiembros.activo, true),
            // Un ministerio apagado no da ámbito ni mando. `archivarMinisterio`
            // ya da de baja al equipo entero, pero no es el único camino a
            // `activo = false` —basta un UPDATE a mano—, y sin esto el menú
            // ofrecería un enlace a un ministerio que la iglesia ya no tiene, y
            // `inicioDe` podría mandar a alguien a él.
            eq(ministerios.activo, true),
          ),
        )
        // El orden del listado de Ministerios: el bloque del menú sale en el
        // mismo orden en que el pastor los ve y los colocó.
        .orderBy(asc(ministerios.orden), asc(ministerios.nombre))
    : [];

  const lidera = equipos.filter((m) => m.rolEquipo !== 'voluntario');

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
      modulos: fila.modulos,
    },
    rol: fila.rol,
    permisos: resolverPermisos(fila.rol, fila.permisos),
    miembroId: fila.miembroId,
    ministerioIds: equipos.map((m) => m.ministerioId),
    ministeriosQueLidera: lidera.map((m) => m.ministerioId),
    ministeriosQueLlevo: lidera.map((m) => ({
      id: m.ministerioId,
      nombre: m.nombre,
      colorHex: m.colorHex,
    })),
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
    // El mismo orden que `getCurrentUserContext`, y por lo mismo: con dos
    // solicitudes abiertas a la vez —el unique es por pareja—, sin `order by`
    // la pantalla podía nombrar una iglesia en una carga y otra en la
    // siguiente.
    .orderBy(asc(iglesiaUsuarios.createdAt), asc(iglesiaUsuarios.id))
    .limit(1);

  const fila = filas[0];
  return fila ? { iglesiaNombre: fila.nombre, iglesiaSlug: fila.slug } : null;
}
