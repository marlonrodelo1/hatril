import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
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
 *                  iglesia (que ocurre antes de que exista membresía).
 *   - `withUser` → la puerta normal, en `./with-tenant`. Aplica la RLS.
 *
 * Al no existir un `db` neutro, elegir mal exige escribir `dbAdmin`, que se ve
 * en cualquier revisión y se encuentra con un grep.
 *
 * POR QUÉ LA CONEXIÓN SE CREA PEREZOSAMENTE
 * -----------------------------------------
 * La primera versión comprobaba `DATABASE_URL` al cargar el módulo y lanzaba
 * ahí mismo. Parecía lo correcto —fallar pronto— y rompía el `next build`: para
 * recolectar los datos de cada página, Next IMPORTA los módulos del servidor
 * sin ejecutar ninguna consulta. Una página que solo importa `dbAdmin` no
 * necesita base de datos para compilarse, y con la comprobación arriba el build
 * entero se caía por una variable que en ese momento no hace falta.
 *
 * Así que la conexión se abre en el primer acceso de verdad. El error sigue
 * llegando claro y con el mensaje entero, pero cuando alguien consulta.
 */

let instancia: PostgresJsDatabase<typeof schema> | undefined;

// Singleton en `globalThis`: evita agotar el pool con el HMR de desarrollo,
// que recarga los módulos en cada guardado.
const globalForDb = globalThis as unknown as {
  hatrilClient?: ReturnType<typeof postgres>;
};

function conectar(): PostgresJsDatabase<typeof schema> {
  if (instancia) return instancia;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      'Falta DATABASE_URL. Cópiala del botón «Connect» del panel de Supabase ' +
        '(Session pooler, puerto 5432) y ponla en .env.local.',
    );
  }

  const client =
    globalForDb.hatrilClient ??
    postgres(connectionString, {
      /*
       * Sin sentencias preparadas.
       *
       * En modo sesión (5432), que es el que usamos, funcionarían. Se dejan
       * apagadas igualmente para que la aplicación siga funcionando si algún
       * día se cambia al pooler en modo transacción (6543), donde no
       * sobreviven al cambio de conexión entre transacciones. El coste es
       * despreciable y evita un fallo que solo aparecería en producción.
       */
      prepare: false,
      ssl: 'require',
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

  if (process.env.NODE_ENV !== 'production') globalForDb.hatrilClient = client;

  instancia = drizzle(client, { schema });
  return instancia;
}

/**
 * Conexión que SALTA la RLS. Usar solo cuando no hay usuario que suplantar.
 *
 * Es un Proxy para que importar este módulo no abra ninguna conexión: la
 * primera propiedad que se lea (`.select`, `.transaction`…) es la que conecta.
 * Desde fuera se usa igual que un objeto normal.
 */
export const dbAdmin: PostgresJsDatabase<typeof schema> = new Proxy(
  {} as PostgresJsDatabase<typeof schema>,
  {
    get(_destino, propiedad, receptor) {
      return Reflect.get(conectar(), propiedad, receptor);
    },
  },
);
