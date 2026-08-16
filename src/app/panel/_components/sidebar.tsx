'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Users, HandHeart, Inbox, Settings, LogOut } from 'lucide-react';

import { salir } from '@/app/(auth)/actions';
import { iniciales } from '@/lib/format/iniciales';
import type { RolIglesia } from '@/lib/auth/permisos';

/**
 * Barra lateral del panel. 260px, fija, con la iglesia arriba y la persona
 * abajo.
 *
 * SOLO APARECE LO QUE FUNCIONA, Y SOLO A QUIEN PUEDE
 * --------------------------------------------------
 * El diseño dibuja ocho secciones: Inicio, Miembros, Ministerios, Eventos,
 * Finanzas, Seguimiento pastoral, Informes y Ajustes. Aquí están las que
 * existen. Un menú con enlaces que llevan a un 404 —o a un cartel de «pronto»—
 * hace parecer roto un producto que funciona.
 *
 * Y se recorta además por permisos: Solicitudes solo para quien puede
 * aprobarlas, Ajustes solo para el pastor. Una sección que al pulsarla rebota
 * con «no tienes acceso» parece un fallo del producto, no un permiso que falta.
 */

const ETIQUETAS_ROL: Record<RolIglesia, string> = {
  pastor: 'Pastor',
  lider: 'Líder',
  tesorero: 'Tesorero',
  secretaria: 'Secretaría',
  miembro: 'Miembro',
};

export function PanelSidebar({
  iglesiaNombre,
  iglesiaCiudad,
  personaNombre,
  rol,
  solicitudesPendientes,
  puedeVerSolicitudes,
  esPastorDeLaIglesia,
}: {
  iglesiaNombre: string;
  iglesiaCiudad: string | null;
  personaNombre: string;
  rol: RolIglesia;
  solicitudesPendientes: number;
  puedeVerSolicitudes: boolean;
  esPastorDeLaIglesia: boolean;
}) {
  const pathname = usePathname();

  // El menú se arma según lo que esta persona puede hacer. Enseñar una sección
  // que al pulsarla rebota con «no tienes acceso» es peor que no enseñarla:
  // parece que el producto falla, no que falte un permiso.
  const secciones = [
    { href: '/panel/hoy', etiqueta: 'Inicio', Icono: House, aviso: 0 },
    { href: '/panel/miembros', etiqueta: 'Miembros', Icono: Users, aviso: 0 },
    {
      href: '/panel/ministerios',
      etiqueta: 'Ministerios',
      Icono: HandHeart,
      aviso: 0,
    },
    ...(puedeVerSolicitudes
      ? [
          {
            href: '/panel/solicitudes',
            etiqueta: 'Solicitudes',
            Icono: Inbox,
            aviso: solicitudesPendientes,
          },
        ]
      : []),
    ...(esPastorDeLaIglesia
      ? [
          {
            href: '/panel/ajustes',
            etiqueta: 'Ajustes',
            Icono: Settings,
            aviso: 0,
          },
        ]
      : []),
  ];

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-[260px] flex-none flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-[11px] border-b border-border px-[18px] pb-[18px] pt-5">
        <span className="flex size-[38px] flex-none items-center justify-center rounded-[10px] bg-primary text-[14px] font-bold tracking-[-0.02em] text-primary-foreground">
          {iniciales(iglesiaNombre)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-[15px] font-bold tracking-[-0.015em]">
            {iglesiaNombre}
          </span>
          {iglesiaCiudad && (
            <span className="truncate text-[12px] text-muted-foreground">
              {iglesiaCiudad}
            </span>
          )}
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
        {secciones.map(({ href, etiqueta, Icono, aviso }) => {
          // `startsWith` para que la ficha de un miembro (`/panel/miembros/…`)
          // mantenga Miembros marcado. Con igualdad exacta, entrar en una ficha
          // apaga el menú entero y no se sabe dónde se está.
          const activa = pathname === href || pathname.startsWith(`${href}/`);

          return (
            <Link
              key={href}
              href={href}
              aria-current={activa ? 'page' : undefined}
              className={
                'flex h-10 items-center gap-[11px] rounded-lg px-3 text-[15px] no-underline transition-colors hover:no-underline ' +
                (activa
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'font-medium text-muted-foreground hover:bg-background hover:text-foreground')
              }
            >
              <Icono className="size-[19px] flex-none" strokeWidth={1.6} />
              {etiqueta}
              {aviso > 0 && (
                <span
                  // El texto del aria-label dice qué cuenta el número. Un «3»
                  // suelto en un lector de pantalla no significa nada.
                  aria-label={`${aviso} sin revisar`}
                  className="ml-auto flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11.5px] font-bold text-primary-foreground"
                >
                  {aviso}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-border p-3">
        <span className="flex size-9 flex-none items-center justify-center rounded-full bg-muted text-[12.5px] font-bold text-muted-foreground">
          {iniciales(personaNombre)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="truncate text-[14px] font-semibold">
            {personaNombre}
          </span>
          <span className="text-[12px] text-muted-foreground">
            {ETIQUETAS_ROL[rol]}
          </span>
        </div>
        <form action={salir}>
          <button
            type="submit"
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="flex size-[34px] flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <LogOut className="size-[18px]" strokeWidth={1.6} />
          </button>
        </form>
      </div>
    </aside>
  );
}
