'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Menu, X } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { SECCIONES, seccionActiva } from './secciones';

/**
 * El menú de `/admin` en móvil. El mismo patrón que `panel/_components/menu-movil.tsx`,
 * incluido el cierre al navegar ajustando el estado durante el render (el
 * porqué está allí): sin él, el cajón se queda abierto encima de la pantalla
 * nueva.
 */
export function AdminMenuMovil() {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  const [rutaPintada, setRutaPintada] = useState(pathname);
  if (rutaPintada !== pathname) {
    setRutaPintada(pathname);
    setAbierto(false);
  }

  const activa = seccionActiva(pathname);

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-active hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 md:hidden"
        aria-label="Abrir el menú"
      >
        <Menu className="size-[21px]" strokeWidth={1.7} />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/25 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />

        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[280px] max-w-[85vw] flex-col border-r border-border bg-surface outline-none data-closed:animate-out data-closed:slide-out-to-left data-open:animate-in data-open:slide-in-from-left">
          <div className="flex flex-none items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Logo tamano={22} />
              <Dialog.Title className="t-micro">Administración</Dialog.Title>
            </div>

            <Dialog.Close
              className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
              aria-label="Cerrar el menú"
            >
              <X className="size-[18px]" strokeWidth={1.7} />
            </Dialog.Close>
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
                    'flex h-11 items-center gap-3 rounded-md px-3 text-[14.5px] no-underline transition-colors hover:no-underline ' +
                    (esActiva
                      ? 'bg-accent font-semibold text-accent-foreground'
                      : 'font-medium text-muted-foreground')
                  }
                >
                  <Icono className="size-[19px] flex-none" strokeWidth={1.7} />
                  <span className="truncate">{etiqueta}</span>
                </Link>
              );
            })}
          </nav>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
