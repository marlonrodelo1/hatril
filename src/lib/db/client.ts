import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * La conexión a Postgres. Vive en su propio fichero —y no en `index.ts`— para
 * que `with-tenant.ts` pueda importarla sin cerrar un ciclo con el índice que
 * a su vez reexporta `withUser`.
 *
 * NO SE EXPORTA UN `db` A SECAS, Y ES A PROPÓSITO
 * -----------------------------------------------
 * Esta conexión entra como rol `postgres`, que tiene BYPASSRLS. Es decir: por
 * aquí las policies de seguridad NO SE APLICAN.
 *
 * Gonper exporta justo esta conexión como `db` y la usa en todas partes. El
 * resultado es que su RLS es decorativa y el aislamiento entre negocios depende
 * de que ningún `WHERE salon_id = …` se olvide nunca, en ninguna consulta, para
 * siempre. Está admitido en su propio repo
 * (`docs/migrations/20260508_enable_rls_pendientes.sql`). Para una peluquería
 * pasa; para datos de categoría especial del art. 9 del RGPD, no.
 *
 * Aquí hay dos puertas y hay que elegir una explícitamente:
 *
 *   - `dbAdmin`  → salta la RLS. Crons, webhooks, super admin y el alta de
 *                  iglesia (que ocurre antes de que exista membresía alguna).
 *   - `withUser` → la puerta normal, en `./with-tenant`. Aplica la RLS.
 *
 * Al no existir un `db` neutro, elegir mal exige escribir `dbAdmin`, que se ve
 * en cualquier revisión y se encuentra con un grep.
 */

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Un `!` silencioso aquí produce el error incomprensible de postgres-js sobre
  // una URL vacía, tres capas más abajo y sin pista del origen.
  throw new Error(
    'Falta DATABASE_URL. Cópiala de Supabase → Project Settings → Database.',
  );
}

// Singleton: evita agotar el pool con el HMR de desarrollo y con cada
// invocación serverless.
const globalForDb = globalThis as unknown as {
  hatrilClient?: ReturnType<typeof postgres>;
};

export const client =
  globalForDb.hatrilClient ??
  postgres(connectionString, {
    // Obligatorio con el pooler en modo transacción de Supabase: las sentencias
    // preparadas no sobreviven al cambio de conexión entre transacciones.
    prepare: false,
    ssl: 'require',
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.hatrilClient = client;

/**
 * Conexión que SALTA la RLS. Usar solo cuando no hay usuario que suplantar.
 *
 * Si estás escribiendo una consulta a petición de alguien que ha iniciado
 * sesión, esta no es la puerta: es `withUser`.
 */
export const dbAdmin = drizzle(client, { schema });
