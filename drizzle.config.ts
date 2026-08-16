import { readFileSync } from 'node:fs';
import { defineConfig } from 'drizzle-kit';

/*
 * drizzle-kit carga `.env`, pero no `.env.local`, que es donde Next.js espera
 * los secretos y donde los tenemos. Sin esto, `db:migrate` falla con un
 * «DATABASE_URL no definida» aunque el fichero esté delante.
 *
 * Se lee a mano en lugar de añadir `dotenv` como dependencia: son seis líneas
 * y este fichero solo corre en local. Si la variable ya viene del entorno —en
 * CI, por ejemplo— no se toca.
 */
if (!process.env.DATABASE_URL) {
  try {
    for (const linea of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith('#')) continue;
      const igual = limpia.indexOf('=');
      if (igual === -1) continue;
      const clave = limpia.slice(0, igual).trim();
      if (!process.env[clave]) {
        process.env[clave] = limpia.slice(igual + 1).trim();
      }
    }
  } catch {
    // Sin `.env.local` no pasa nada: las variables vendrán del entorno.
  }
}

/**
 * El repo es la fuente de verdad del schema. Sin excepciones.
 *
 * Los dos proyectos anteriores lo hacen mal, cada uno a su manera, y las dos
 * maneras duelen:
 *
 *   - Gonper apunta su `drizzle.config.ts` a `./drizzle`, un directorio que no
 *     existe, y aplica medio centenar de `.sql` sueltos con scripts de `tsx`.
 *   - Pidoo aplicó la mayoría de sus migraciones directamente a producción por
 *     MCP sin espejarlas a fichero. Hoy hay funciones que sus policies usan y
 *     que no están definidas en ningún archivo del repositorio.
 *
 * Aquí: `npm run db:generate` produce el SQL, se revisa a mano, se commitea y
 * se aplica con `npm run db:migrate`. Nada llega a la base de datos sin pasar
 * por un fichero versionado.
 */
export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  // El SQL que genera es para revisarlo, no solo para ejecutarlo.
  verbose: true,
  // Pide confirmación antes de cualquier sentencia que pueda perder datos.
  strict: true,
});
