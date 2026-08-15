'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Users, HandHeart, Settings, LogOut } from 'lucide-react';

import { salir } from '@/app/(auth)/actions';
import { iniciales } from '@/lib/format/iniciales';
import type { RolIglesia } from '@/lib/auth/permisos';

/**
 * Barra lateral del panel. 260px, fija, con la iglesia arriba y la persona
 * abajo.
 *
 * SOLO APARECE LO QUE FUNCIONA
 * ----------------------------
 * El diseño dibuja ocho secciones: Inicio, Miembros, Ministerios, Eventos,
 * Finanzas, Seguimiento pastoral, Informes y Ajustes. Aquí están las cuatro que
 * existen. Un menú con cinco enlaces que llevan a un 404 —o a un cartel de
 * «pronto»— hace parecer roto un producto que funciona. Se van añadiendo según
 * se construyen.
 */

const ETIQUETAS_ROL: Record<RolIglesia, string> = {
  pastor: 'Pastor',
  lider: 'Líder',
  tesorero: 'Tesorero',
  secretaria: 'Secretaría',
  miembro: 'Miembro',
};

const SECCIONES = [
  { href: '/panel/hoy', etiqueta: 'Inicio', Icono: House },
  { href: '/panel/miembros', etiqueta: 'Miembros', Icono: Users },
  { href: '/panel/ministerios', etiqueta: 'Ministerios', Icono: HandHeart },
  { href: '/panel/ajustes', etiqueta: 'Ajustes', Icono: Settings },
] as const;

export function PanelSidebar({
  iglesiaNombre,
  iglesiaCiudad,
  personaNombre,
  rol,
}: {
  iglesiaNombre: string;
  iglesiaCiudad: string | null;
  personaNombre: string;
  rol: RolIglesia;
}) {
  const pathname = usePathname();

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
        {SECCIONES.map(({ href, etiqueta, Icono }) => {
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
