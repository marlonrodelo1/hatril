import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * El guard de la sección, y va aquí y no en cada página.
 *
 * Es la regla del repo: en el layout quedan cubiertas también las rutas
 * dinámicas —`/panel/eventos/[id]`, `/panel/eventos/[id]/editar`—, que es donde
 * se cuelan los huecos. En el proyecto anterior `/panel/clientes` estaba
 * guardado y `/panel/clientes/[id]` no.
 *
 * La excepción conocida: `[id]/exportar/route.ts` NO queda cubierto por esto.
 * Los route handlers no participan en layouts, así que lleva su propio
 * `requirePermisoApi`.
 */
export default async function EventosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('gestionar_eventos');
  return <>{children}</>;
}
