import {
  Church,
  History,
  LayoutDashboard,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

/**
 * Las secciones del panel de super admin, para el menú lateral, el de móvil y
 * el buscador.
 *
 * Una lista seguida y no bloques con encabezado, como el panel de la iglesia o
 * el admin de Pidoo: allí hay once y dieciséis entradas y hay que saltar a un
 * grupo. Aquí son cuatro; un encabezado encima sería más ruido que ayuda.
 * Cuando pasen de seis, agrupar.
 */
export const SECCIONES: { href: string; etiqueta: string; Icono: LucideIcon }[] = [
  { href: '/admin', etiqueta: 'Inicio', Icono: LayoutDashboard },
  { href: '/admin/iglesias', etiqueta: 'Iglesias', Icono: Church },
  { href: '/admin/cuentas', etiqueta: 'Cuentas', Icono: UsersRound },
  { href: '/admin/registro', etiqueta: 'Registro', Icono: History },
];

/**
 * Las listas en las que el buscador (Ctrl K) ofrece «Buscar «x» en …».
 *
 * Solo estas dos porque son las dos que ya filtran por `?q=` en su propia
 * página, con su guarda y su consulta de siempre: el buscador no consulta
 * nada, solo lleva hasta ahí con el texto puesto. Registro no busca por texto.
 * Si una sección nueva aprende a filtrar por `q`, basta con añadirla aquí.
 */
export const BUSCABLES: readonly string[] = ['/admin/iglesias', '/admin/cuentas'];

/**
 * La entrada marcada: la más larga que contiene la ruta. Con «empieza por» a
 * secas, `/admin` estaría marcada en todas las pantallas a la vez.
 */
export function seccionActiva(pathname: string): string | null {
  let activa: string | null = null;
  for (const { href } of SECCIONES) {
    const contiene = pathname === href || pathname.startsWith(`${href}/`);
    if (contiene && href.length > (activa?.length ?? 0)) activa = href;
  }
  return activa;
}
