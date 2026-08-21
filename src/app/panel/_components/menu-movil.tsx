'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { ExternalLink, Menu, X } from 'lucide-react';

import { construirMenu } from '@/lib/panel/secciones';
import type { FlagsDelMenu } from '@/lib/panel/menu';
import { MarcaIglesia } from './marca-iglesia';

/**
 * El menú del panel en móvil.
 *
 * ESTO NO ES UNA MEJORA, ES UN AGUJERO QUE ESTABA ABIERTO
 * -------------------------------------------------------
 * El menú lateral era `hidden … md:flex` y no había nada que lo sustituyera:
 * por debajo de 768px el panel no tenía navegación NINGUNA. Ni menú, ni enlace
 * a otra sección, ni botón de cerrar sesión —que vivía dentro del propio
 * lateral oculto—. Cada pantalla era una isla y solo se salía escribiendo la
 * dirección a mano o con el botón atrás del navegador.
 *
 * El patrón está copiado de `src/app/i/[slug]/_components/cabecera.tsx`, que ya
 * había resuelto exactamente esto para la web pública y por el mismo motivo.
 *
 * SE CIERRA AL NAVEGAR, Y HAY QUE FORZARLO
 * ----------------------------------------
 * Next no desmonta el diálogo al cambiar de ruta: la navegación es del cliente
 * y el panel se quedaría abierto encima de la pantalla nueva. Lo cierra la
 * comparación de `pathname` que hay más abajo, dentro del render.
 */
export function MenuMovil({
  flags,
  iglesiaNombre,
  iglesiaCiudad,
  iniciales,
  logoUrl,
  webIglesia,
}: {
  flags: FlagsDelMenu;
  iglesiaNombre: string;
  iglesiaCiudad: string | null;
  /** Su web pública, o null si todavía no la ha publicado. */
  webIglesia: string | null;
  iniciales: string;
  /** El logo de la iglesia, o null. */
  logoUrl: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();

  /*
   * Cerrar al navegar, ajustando el estado DURANTE el render y no en un
   * `useEffect`.
   *
   * La primera versión lo hacía con un efecto sobre `pathname` y el lint de
   * React lo rechaza: un `setState` síncrono dentro de un efecto provoca un
   * segundo render en cascada. Este es el patrón que la documentación de React
   * llama «ajustar el estado cuando cambian las props» — React descarta el
   * render a medias y vuelve a empezar con el valor nuevo, sin pintar nunca el
   * estado intermedio y sin pasar por el navegador.
   */
  const [rutaPintada, setRutaPintada] = useState(pathname);
  if (rutaPintada !== pathname) {
    setRutaPintada(pathname);
    setAbierto(false);
  }

  const bloques = construirMenu(flags);

  return (
    <Dialog.Root open={abierto} onOpenChange={setAbierto}>
      <Dialog.Trigger
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-background hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 md:hidden"
        aria-label="Abrir el menú"
      >
        <Menu className="size-[21px]" strokeWidth={1.7} />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/25 data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />

        <Dialog.Popup className="fixed inset-y-0 left-0 z-50 flex h-dvh w-[280px] max-w-[85vw] flex-col border-r border-border bg-surface outline-none data-closed:animate-out data-closed:slide-out-to-left data-open:animate-in data-open:slide-in-from-left">
          <div className="flex flex-none items-center gap-[11px] border-b border-border px-4 py-4">
            <MarcaIglesia
              logoUrl={logoUrl}
              iniciales={iniciales}
              nombre={iglesiaNombre}
            />

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <Dialog.Title className="truncate text-[14.5px] font-bold leading-none tracking-[-0.015em]">
                {iglesiaNombre}
              </Dialog.Title>
              {iglesiaCiudad && (
                <span className="truncate text-[12px] leading-none text-muted-foreground">
                  {iglesiaCiudad}
                </span>
              )}
            </div>

            <Dialog.Close
              className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              aria-label="Cerrar el menú"
            >
              <X className="size-[18px]" strokeWidth={1.7} />
            </Dialog.Close>
          </div>

          <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-3">
            {bloques.map((bloque, i) => (
              <div key={bloque.titulo ?? i} className="flex flex-col gap-0.5">
                {/* En móvil los bloques no se pliegan: caben de sobra en la
                    altura de un teléfono y un acordeón aquí solo añade una
                    pulsación entre la persona y donde va. */}
                {bloque.titulo && (
                  <span className="mb-1 px-3">
                    <span className="t-micro">{bloque.titulo}</span>
                  </span>
                )}

                {bloque.secciones.map(({ href, etiqueta, Icono, aviso }) => {
                  const activa =
                    pathname === href || pathname.startsWith(`${href}/`);

                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={activa ? 'page' : undefined}
                      className={
                        'flex h-11 items-center gap-3 rounded-md px-3 text-[14.5px] no-underline transition-colors hover:no-underline ' +
                        (activa
                          ? 'bg-accent font-semibold text-accent-foreground'
                          : 'font-medium text-muted-foreground')
                      }
                    >
                      <Icono className="size-[19px] flex-none" strokeWidth={1.7} />
                      {etiqueta}
                      {aviso > 0 && (
                        <span
                          aria-label={`${aviso} sin revisar`}
                          className="ml-auto flex min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11.5px] font-bold text-primary-foreground tabular-nums"
                        >
                          {aviso}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          {webIglesia && (
            <a
              href={webIglesia}
              target="_blank"
              rel="noopener noreferrer"
              className="m-3 flex h-10 flex-none items-center justify-center gap-2 rounded-lg border border-border bg-surface-alt text-[13.5px] font-semibold text-foreground no-underline transition-colors hover:bg-background hover:no-underline"
            >
              <ExternalLink className="size-[15px] flex-none" strokeWidth={1.8} />
              Ver la web de la iglesia
            </a>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
