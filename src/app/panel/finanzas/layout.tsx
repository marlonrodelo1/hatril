import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * Marco de finanzas.
 *
 * El guard va aquí y no en cada página: puesto en el layout cubre la sección
 * entera, incluidas `/movimientos/[id]` y cualquier ruta dinámica que llegue
 * después. Es la regla del repo, y nació de que en Gonper `/panel/clientes`
 * estaba guardado y `/panel/clientes/[id]` no.
 *
 * Ojo con lo que esto NO hace: no aísla una iglesia de otra. Eso son las
 * policies y `withUser()`. Si este guard faltara, alguien sin permiso vería la
 * caja de SU congregación —malo— pero nunca la de otra.
 *
 * La exportación a CSV NO queda cubierta por esto aunque cuelgue de la misma
 * carpeta: los route handlers no participan en layouts. Lleva su propio guard.
 */
export default async function FinanzasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('gestionar_finanzas');
  return <>{children}</>;
}
