import { requirePastor } from '@/lib/auth/guard-panel';

/**
 * Los fondos y las cajas son gobierno, no operativa.
 *
 * Crear un fondo es decidir cómo se estructura el dinero de la congregación —qué
 * parte está comprometida con la obra y cuál se puede gastar—, y eso no se
 * delega. El tesorero apunta en los fondos que existan; quién decide que exista
 * «Construcción» es el pastor.
 *
 * Sub-layout con su propio guard en vez de esconder el enlace: un menú oculto no
 * es una autorización, y a esta ruta se llega escribiéndola.
 */
export default async function AjustesFinanzasLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePastor();
  return <>{children}</>;
}
