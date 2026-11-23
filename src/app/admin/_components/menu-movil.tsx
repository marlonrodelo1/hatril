'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ExternalLink, Menu } from 'lucide-react';
import { clsx } from 'clsx';

import { Hoja } from '@/components/hoja';
import { SECCIONES, seccionActiva } from './secciones';
import { textoPendientes, usePendientes } from './marco-contexto';

/**
 * El menú de `/admin` en móvil.
 *
 * EN LA HOJA, COMO EL RESTO DEL PRODUCTO (zona 4, 18-nov)
 * -------------------------------------------------------
 * Era un cajón que salía por la izquierda. Ahora sube desde abajo en la misma
 * `Hoja` del muro, de la agenda y del menú de la web de cada iglesia: es donde
 * llega el pulgar, y una sola forma de «menú en el móvil» se aprende una vez.
 * Lleva el número de pendientes junto a Inicio, igual que el lateral.
 *
 * SE CIERRA AL NAVEGAR, Y HAY QUE FORZARLO
 * ----------------------------------------
 * Next no desmonta la hoja al cambiar de ruta: la navegación es del cliente y
 * se quedaría abierta encima de la pantalla nueva. La cierra la comparación de
 * `pathname` de abajo, ajustando el estado durante el render y no en un efecto
 * (el porqué está en `panel/_components/menu-movil.tsx`).
 */
export function AdminMenuMovil() {
  const [abierto, setAbierto] = useState(false);
  const pathname = usePathname();
  const pendientes = usePendientes();

  const [rutaPintada, setRutaPintada] = useState(pathname);
  if (rutaPintada !== pathname) {
    setRutaPintada(pathname);
    setAbierto(false);
  }

  // Cerrarla al llegar al ancho donde ya está el menú lateral. Por encima de
  // `md` la hoja se vuelve un diálogo centrado, y quien gira la tableta se
  // quedaría con un menú flotando al lado del de verdad.
  useEffect(() => {
    if (!abierto) return;
    const ancho = window.matchMedia('(min-width: 768px)');
    function cambioAncho() {
      if (ancho.matches) setAbierto(false);
    }
    ancho.addEventListener('change', cambioAncho);
    return () => ancho.removeEventListener('change', cambioAncho);
  }, [abierto]);

  const activa = seccionActiva(pathname);

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Abrir el menú"
        aria-expanded={abierto}
        className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-surface-active hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20 md:hidden"
      >
        <Menu className="size-[21px]" strokeWidth={1.8} />
      </button>

      <Hoja
        abierta={abierto}
        onCambio={setAbierto}
        titulo="Administración"
        descripcion="Las secciones del panel de la plataforma."
      >
        <nav
          aria-label="Administración"
          className="flex flex-col pb-[env(safe-area-inset-bottom)]"
        >
          {SECCIONES.map(({ href, etiqueta, Icono }) => {
            const esActiva = href === activa;
            const aviso = href === '/admin' ? pendientes : 0;
            return (
              <Link
                key={href}
                href={href}
                aria-current={esActiva ? 'page' : undefined}
                className={clsx(
                  'flex min-h-12 items-center gap-3 border-b border-border px-1 text-body no-underline transition-colors duration-150 hover:no-underline active:bg-surface-active motion-reduce:transition-none',
                  // La sección abierta, con el par de «lo elegido» de la guía.
                  // Sin relleno, como en la hoja de la web de cada iglesia:
                  // entre filas separadas por una línea, un bloque de color
                  // parece otro botón.
                  esActiva
                    ? 'font-bold text-accent-foreground hover:text-accent-foreground'
                    : 'font-semibold text-foreground hover:text-foreground',
                )}
              >
                <Icono
                  aria-hidden
                  strokeWidth={1.8}
                  className={clsx(
                    'size-[18px] flex-none',
                    esActiva ? 'text-accent-foreground' : 'text-muted-foreground',
                  )}
                />
                <span className="flex-1 truncate">{etiqueta}</span>
                {aviso > 0 && (
                  <span
                    aria-label={textoPendientes(aviso)}
                    className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-micro font-bold text-accent-foreground tabular-nums"
                  >
                    {aviso}
                  </span>
                )}
              </Link>
            );
          })}

          {/* La portada en otra pestaña: quien la abre desde aquí quiere mirar
              cómo la ve una iglesia que llega, no irse del admin. */}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 items-center gap-3 px-1 text-body font-semibold text-foreground no-underline transition-colors duration-150 hover:text-foreground hover:no-underline active:bg-surface-active motion-reduce:transition-none"
          >
            <ExternalLink
              aria-hidden
              strokeWidth={1.8}
              className="size-[18px] flex-none text-muted-foreground"
            />
            <span className="flex-1">Ver la portada</span>
          </a>
        </nav>
      </Hoja>
    </>
  );
}
