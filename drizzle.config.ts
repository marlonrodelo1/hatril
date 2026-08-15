import { defineConfig } from 'drizzle-kit';

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
