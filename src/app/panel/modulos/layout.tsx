import { requirePermiso } from '@/lib/auth/guard-panel';

/**
 * Activar un módulo es crear un ministerio, así que pide lo mismo que crearlo:
 * `gestionar_ministerios`. El pastor pasa siempre, porque `requirePermiso` lo
 * deja entrar antes de mirar el permiso.
 *
 * Un líder acotado no entra: configura lo de dentro de su ministerio, pero qué
 * ministerios tiene la iglesia lo decide quien la gobierna.
 *
 * Las actions no pasan por aquí —un layout no se ejecuta en una server action—,
 * así que cada una lleva su `requirePermisoAccion`.
 */
export default async function ModulosLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePermiso('gestionar_ministerios');
  return <>{children}</>;
}
