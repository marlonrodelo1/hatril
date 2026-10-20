import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * El guard de la sección, repetido aquí solo para la navegación.
 *
 * NO protege nada: en Next 16 la página se ejecuta aunque el layout redirija, y
 * lo que consulta viaja en el payload RSC. Cada página de eventos pone su propio
 * `requirePermiso('gestionar_eventos')`, y `[id]/exportar/route.ts` el suyo en
 * `requirePermisoApi`. Ver CLAUDE.md y `npm run test:puertas`.
 */
export default async function EventosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('gestionar_eventos');
  return <>{children}</>;
}
