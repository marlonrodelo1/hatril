import { requirePastor } from '@/lib/auth/guard-panel';

/**
 * Guard de la sección de equipo.
 *
 * `requirePastor` y no un permiso, a propósito: `permisos.ts` declara que el
 * gobierno de la iglesia no se delega, y la policy `iglesia_usuarios_update_pastor`
 * de la migración `0001` dice lo mismo en SQL. Un permiso «gestionar el equipo»
 * daría a quien lo tuviera la capacidad de concederse los demás.
 *
 * En el `layout.tsx` y no en la página, por la regla de siempre: así queda
 * cubierta la carpeta entera, incluidas las rutas dinámicas que vengan después
 * —una ficha `/panel/lideres/[id]` es más que previsible—, que es justo donde se
 * cuelan los huecos.
 */
export default async function LideresLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePastor();
  return <>{children}</>;
}
