import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * El guard de la sección, en el layout y no en cada página.
 *
 * Es la regla del repo, y aquí pesa más que en otras secciones: `[id]` es la
 * pantalla donde se lee quién estuvo en un culto y quién no. Guardar `page.tsx`
 * y olvidar la ruta dinámica dejaría el listado cerrado y el dato abierto, que
 * es exactamente el hueco que tuvo el proyecto anterior con `/panel/clientes`.
 */
export default async function ReunionesLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('registrar_asistencia');
  return <>{children}</>;
}
