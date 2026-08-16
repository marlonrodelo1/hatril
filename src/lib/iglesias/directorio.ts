import 'server-only';

import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';

import { withAnon, dbAdmin } from '@/lib/db';
import { iglesias } from '@/lib/db/schema';

/**
 * El directorio público de iglesias.
 *
 * AQUÍ SÍ SE USA `withAnon`
 * -------------------------
 * Es el único sitio del producto donde se consulta como visitante, y por eso
 * es la prueba de que las tres capas de seguridad valen para algo:
 *
 *   - La POLICY de `anon` deja ver solo iglesias con `visible_en_directorio` y
 *     `activa`. Aunque el `where` de aquí abajo desapareciera, no saldría una
 *     congregación que no se ha publicado.
 *   - Los GRANT POR COLUMNA limitan lo que se puede pedir de cada fila. Aunque
 *     alguien escribiera `select *`, las columnas de facturación no vienen.
 *   - Y `miembros` no está concedida a `anon` ni en una columna, así que desde
 *     este camino la congregación es inalcanzable por definición.
 *
 * La web pública de cada iglesia (`/i/[slug]`) va por otro sitio y con
 * `dbAdmin`, porque tiene que servir también a las iglesias no listadas. El
 * porqué está en `./publica.ts`.
 */

export type IglesiaEnDirectorio = {
  id: string;
  slug: string;
  nombre: string;
  denominacion: string | null;
  descripcion: string | null;
  ciudad: string | null;
  pais: string;
  logoUrl: string | null;
  aceptaSolicitudes: boolean;
};

export async function buscarIglesias(
  busqueda?: string,
): Promise<IglesiaEnDirectorio[]> {
  return withAnon((tx) =>
    tx
      .select({
        id: iglesias.id,
        slug: iglesias.slug,
        nombre: iglesias.nombre,
        denominacion: iglesias.denominacion,
        descripcion: iglesias.descripcion,
        ciudad: iglesias.ciudad,
        pais: iglesias.pais,
        logoUrl: iglesias.logoUrl,
        aceptaSolicitudes: iglesias.aceptaSolicitudes,
      })
      .from(iglesias)
      .where(
        busqueda
          ? or(
              ilike(iglesias.nombre, `%${busqueda}%`),
              ilike(iglesias.ciudad, `%${busqueda}%`),
              ilike(iglesias.denominacion, `%${busqueda}%`),
            )
          : undefined,
      )
      .orderBy(asc(iglesias.nombre))
      .limit(60),
  );
}

/**
 * Una iglesia del directorio, por slug, para la pantalla de solicitud.
 *
 * Va por `dbAdmin` y no por `withAnon` a propósito: quien solicita entrar ya
 * tiene sesión, así que su rol en Postgres sería `hatril_app` y no `anon`, y
 * `hatril_app` solo ve iglesias a las que YA pertenece. Sin esta excepción,
 * nadie podría solicitar entrar a ninguna parte.
 *
 * Las columnas se enumeran a mano y la condición exige `acepta_solicitudes`:
 * es la misma comprobación que hace la policy de INSERT, adelantada para poder
 * dar un mensaje en lugar de un error de base de datos.
 */
export async function iglesiaParaSolicitar(slug: string) {
  const filas = await dbAdmin
    .select({
      id: iglesias.id,
      slug: iglesias.slug,
      nombre: iglesias.nombre,
      ciudad: iglesias.ciudad,
      denominacion: iglesias.denominacion,
      logoUrl: iglesias.logoUrl,
      aceptaSolicitudes: iglesias.aceptaSolicitudes,
    })
    .from(iglesias)
    .where(and(eq(iglesias.slug, slug), eq(iglesias.activa, true)))
    .limit(1);

  return filas[0] ?? null;
}

/** Cuántas iglesias hay publicadas. Para el encabezado del directorio. */
export async function totalEnDirectorio(): Promise<number> {
  const [fila] = await withAnon((tx) =>
    tx.select({ total: sql<number>`count(*)` }).from(iglesias),
  );

  return Number(fila?.total ?? 0);
}
