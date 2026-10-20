import { requirePastor } from '@/lib/auth/guard-panel';

/**
 * Guard de la sección de equipo.
 *
 * `requirePastor` y no un permiso, a propósito: `permisos.ts` declara que el
 * gobierno de la iglesia no se delega, y la policy `iglesia_usuarios_update_pastor`
 * de la migración `0001` dice lo mismo en SQL. Un permiso «gestionar el equipo»
 * daría a quien lo tuviera la capacidad de concederse los demás.
 *
 * Aquí se repite solo para la navegación. NO protege nada: en Next 16 la página
 * se ejecuta aunque el layout redirija, y lo que consulta viaja en el payload
 * RSC. La página pone su propio `requirePastor()`, y cualquier ruta que venga
 * después —una ficha `/panel/lideres/[id]`— tendrá que ponerlo también. Ver
 * CLAUDE.md y `npm run test:puertas`.
 */
export default async function LideresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePastor();
  return <>{children}</>;
}
