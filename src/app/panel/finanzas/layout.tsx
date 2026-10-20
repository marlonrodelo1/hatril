import { requireFinanzas } from '@/lib/auth/guard-panel';

/**
 * Marco de finanzas.
 *
 * El guard se repite aquí solo para la navegación. NO protege nada: en Next 16
 * la página se ejecuta aunque el layout redirija, y lo que consulta viaja en el
 * payload RSC. Cada página de finanzas pone su propio guard, y la exportación
 * el suyo en `requirePermisoApi`. Ver CLAUDE.md y `npm run test:puertas`.
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
  await requireFinanzas();
  return <>{children}</>;
}
