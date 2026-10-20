import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * El guard de la sección, repetido aquí solo para la navegación.
 *
 * NO protege nada: en Next 16 la página se ejecuta aunque el layout redirija, y
 * lo que consulta viaja en el payload RSC. Aquí pesa más que en otras
 * secciones, porque `[id]` es donde se lee quién estuvo en un culto y quién no:
 * cada página pone su propio `requirePermiso('registrar_asistencia')`. Ver
 * CLAUDE.md y `npm run test:puertas`.
 */
export default async function ReunionesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('registrar_asistencia');
  return <>{children}</>;
}
