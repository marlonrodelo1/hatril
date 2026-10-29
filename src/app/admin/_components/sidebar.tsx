'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ExternalLink } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { SECCIONES, seccionActiva } from './secciones';

/**
 * El menú lateral de `/admin`, solo en escritorio; en móvil lo sustituye
 * `menu-movil.tsx` con las mismas `SECCIONES`.
 *
 * Copia la forma del lateral del panel —mismo ancho, mismas filas, la activa
 * en `bg-accent`— para que pasar de una iglesia al admin no sea cambiar de
 * aplicación. Lo que cambia es arriba: aquí va la marca de Hatril y no la de
 * una congregación, y debajo «Administración», que es lo que dice en qué lado
 * de la plataforma estás.
 *
 * Sin encoger ni bloques plegables: con cuatro entradas no hay nada que ganar.
 */
export function AdminSidebar() {
  const pathname = usePathname();
  const activa = seccionActiva(pathname);

  return (
    <aside className="sticky top-0 z-20 hidden h-dvh w-[264px] flex-none flex-col border-r border-border bg-surface md:flex print:hidden">
      <div className="flex flex-col gap-1.5 border-b border-border px-5 py-4">
        <Logo tamano={22} />
        <span className="t-micro">Administración</span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
        {SECCIONES.map(({ href, etiqueta, Icono }) => {
          const esActiva = href === activa;
          return (
            <Link
              key={href}
              href={href}
              aria-current={esActiva ? 'page' : undefined}
              className={
                'group flex h-9 items-center gap-[11px] rounded-md px-3 text-[13.5px] no-underline transition-colors hover:no-underline ' +
                (esActiva
                  ? 'bg-accent font-semibold text-accent-foreground'
                  : 'font-medium text-muted-foreground hover:bg-surface-alt hover:text-foreground')
              }
            >
              <Icono
                className={
                  'size-[17px] flex-none transition-colors ' +
                  (esActiva ? '' : 'text-muted-foreground group-hover:text-foreground')
                }
                strokeWidth={1.7}
              />
              <span className="truncate">{etiqueta}</span>
            </Link>
          );
        })}
      </nav>

      {/* La portada en otra pestaña: quien la abre desde aquí quiere mirar
          cómo la ve una iglesia que llega, no irse del admin. */}
      <a
        href="/"
        target="_blank"
        rel="noopener noreferrer"
        className="mx-3 mb-3 flex h-9 flex-none items-center justify-center gap-2 rounded-lg border border-border bg-surface-alt text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-surface-active hover:no-underline"
      >
        <ExternalLink className="size-[15px] flex-none" strokeWidth={1.8} />
        Ver la portada
      </a>
    </aside>
  );
}
