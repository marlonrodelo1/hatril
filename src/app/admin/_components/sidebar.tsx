'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { clsx } from 'clsx';

import { Logo } from '@/components/marca/logo';
import { SECCIONES, seccionActiva } from './secciones';
import { BuscadorAdmin } from './buscador-admin';
import { textoPendientes, usePendientes } from './marco-contexto';

/**
 * El menú lateral de `/admin`, solo en escritorio; en móvil lo sustituye
 * `menu-movil.tsx` con las mismas `SECCIONES`.
 *
 * EL MISMO MENÚ QUE EL PANEL (zona 4, 18-nov)
 * -------------------------------------------
 * En la zona 1 se aprobó que el panel de cada iglesia y el super admin
 * compartieran menú, y este se había quedado en el de antes: la sección elegida
 * cambiaba de golpe, no se podía plegar y nada decía que hubiera algo
 * pendiente. Ahora lleva lo mismo que `panel/_components/sidebar.tsx`: el
 * marcador que se desliza, plegar a una columna de iconos que se recuerda, el
 * buscador con Ctrl K y el número junto a «Inicio».
 *
 * No importa el del panel porque aquel está hecho de bloques plegables, la
 * marca de una iglesia y sus permisos; lo que se repite es la manera de hacer,
 * y está copiada con sus porqués.
 *
 * Lo que cambia es arriba: aquí va la marca de Hatril y no la de una
 * congregación, y debajo «Administración», que es lo que dice en qué lado de
 * la plataforma estás. Y abajo, como en la propuesta aprobada, «Ver la
 * portada» y «Plegar el menú»: el panel lleva el plegar junto a la iglesia
 * porque arriba tiene a quién acompañar, y aquí arriba solo está el logo.
 */

/**
 * Su propia clave, no la del panel: quien es super admin y además pastor de
 * una iglesia puede querer el panel ancho y el admin plegado, o al revés.
 */
const CLAVE_ENCOGIDA = 'hatril:admin:menu-encogido';

/*
 * El `localStorage` leído como lo que es: un sistema externo a React.
 *
 * Igual que en el panel, y por lo mismo: leerlo en un `useEffect` con
 * `setState` dentro provocaba un segundo render en cascada en cada carga, y el
 * lint de React lo rechaza. Con `useSyncExternalStore` el servidor recibe el
 * valor por defecto (menú ancho) y el cliente el guardado, sin discordancia de
 * hidratación.
 *
 * El evento `storage` entra en la suscripción para quien tiene el admin
 * abierto en dos pestañas: pliega el menú en una y la otra le sigue.
 */
const oyentes = new Set<() => void>();

function suscribir(avisar: () => void) {
  oyentes.add(avisar);
  window.addEventListener('storage', avisar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener('storage', avisar);
  };
}

function guardar(clave: string, valor: string) {
  window.localStorage.setItem(clave, valor);
  // `storage` solo lo reciben las OTRAS pestañas. Esta se avisa a mano.
  oyentes.forEach((avisar) => avisar());
}

export function AdminSidebar() {
  const pathname = usePathname();
  const activa = seccionActiva(pathname);
  const pendientes = usePendientes();

  const encogida = useSyncExternalStore(
    suscribir,
    () => window.localStorage.getItem(CLAVE_ENCOGIDA) === 'si',
    () => false,
  );

  function alternarAncho() {
    guardar(CLAVE_ENCOGIDA, encogida ? 'no' : 'si');
  }

  /*
   * EL MARCADOR QUE SE DESLIZA (base común, 17-nov)
   *
   * El fondo naranja suave de la sección elegida no va en el enlace: es una
   * pieza aparte que se mueve a la nueva al cambiar de página. El menú vive en
   * el layout y no se vuelve a montar al navegar, así que basta con medir el
   * enlace marcado (`aria-current`) y llevar el fondo hasta él.
   *
   * Se sigue midiendo un cuarto de segundo después de cada cambio: al plegar,
   * el ancho del menú se anima y los enlaces encogen con él; el marcador tiene
   * que acompañarlos en vez de quedarse con el ancho de antes.
   *
   * Mientras no se ha medido (el primer pintado), el enlace lleva el fondo él
   * mismo, para que nunca falte la marca de dónde estás.
   */
  const navRef = useRef<HTMLElement>(null);
  const [marca, setMarca] = useState<{
    x: number;
    y: number;
    ancho: number;
    alto: number;
  } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    let marco = 0;
    const medir = () => {
      const act = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      setMarca(
        act && act.offsetHeight > 0
          ? {
              x: act.offsetLeft,
              y: act.offsetTop,
              ancho: act.offsetWidth,
              alto: act.offsetHeight,
            }
          : null,
      );
    };
    const desde = performance.now();
    const seguir = () => {
      medir();
      if (performance.now() - desde < 260) marco = requestAnimationFrame(seguir);
    };
    seguir();
    const observador = new ResizeObserver(medir);
    observador.observe(nav);
    return () => {
      cancelAnimationFrame(marco);
      observador.disconnect();
    };
  }, [activa, encogida]);

  // Las filas del pie («Ver la portada», «Plegar el menú») tienen la forma de
  // las del menú, sin marcador: no son sitios a los que ir dentro del admin.
  const filaPie = clsx(
    'flex h-9 w-full flex-none cursor-pointer items-center gap-[11px] rounded-md text-label font-medium text-muted-foreground no-underline transition-colors duration-150 outline-none hover:bg-surface-alt hover:text-foreground hover:no-underline focus-visible:ring-3 focus-visible:ring-ring/20',
    encogida ? 'justify-center px-0' : 'px-3',
  );

  return (
    <aside
      className={clsx(
        // `print:hidden` aunque ya sea `hidden` por debajo de `md`: una hoja
        // apaisada puede medir más de 768 px, y el menú saldría impreso.
        'sticky top-0 z-20 hidden h-dvh flex-none flex-col border-r border-border bg-surface transition-[width] duration-200 motion-reduce:transition-none md:flex print:hidden',
        encogida ? 'w-[64px]' : 'w-[264px]',
      )}
    >
      {/* ---------- La marca ---------- */}
      <div
        className={clsx(
          'flex flex-none border-b border-border py-4',
          encogida ? 'justify-center px-2' : 'flex-col gap-1.5 px-5',
        )}
      >
        {encogida ? (
          // Plegado no cabe la palabra: queda el símbolo, el icono de la app.
          <Logo variante="simbolo" tamano={32} />
        ) : (
          <>
            <Logo tamano={22} />
            <span className="t-micro">Administración</span>
          </>
        )}
      </div>

      {/* ---------- El buscador (Ctrl K) ---------- */}
      <div className={clsx('flex-none pt-3', encogida ? 'px-2' : 'px-3')}>
        <BuscadorAdmin encogida={encogida} />
      </div>

      {/* ---------- El menú ---------- */}
      <nav
        ref={navRef}
        aria-label="Administración"
        className={clsx(
          'relative flex flex-1 flex-col gap-0.5 overflow-y-auto pt-1 pb-3',
          encogida ? 'px-2' : 'px-3',
        )}
      >
        {marca && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-0 left-0 rounded-md bg-accent transition-[transform,width,height] duration-240 ease-hatril motion-reduce:transition-none"
            style={{
              width: marca.ancho,
              height: marca.alto,
              transform: `translate(${marca.x}px, ${marca.y}px)`,
            }}
          />
        )}

        {SECCIONES.map(({ href, etiqueta, Icono }) => {
          const esActiva = href === activa;
          // El número solo junto a Inicio, que es donde está la lista de las
          // iglesias que piden atención. Con cero no se pinta nada: un «0»
          // fijo en el menú enseña a no mirarlo.
          const aviso = href === '/admin' ? pendientes : 0;

          return (
            <Link
              key={href}
              href={href}
              aria-current={esActiva ? 'page' : undefined}
              title={encogida ? etiqueta : undefined}
              className={clsx(
                'group relative flex h-9 flex-none items-center gap-[11px] rounded-md text-label no-underline transition-colors hover:no-underline',
                encogida ? 'justify-center px-0' : 'px-3',
                esActiva
                  ? clsx(
                      'font-semibold text-accent-foreground hover:text-accent-foreground',
                      !marca && 'bg-accent',
                    )
                  : // Hover en `surface-alt` y no en `background`: en crema el
                    // fondo de la página casi no se separa del blanco del menú.
                    'font-medium text-muted-foreground hover:bg-surface-alt hover:text-foreground',
              )}
            >
              <Icono
                className={clsx(
                  'size-[17px] flex-none transition-colors',
                  !esActiva && 'text-muted-foreground group-hover:text-foreground',
                )}
                strokeWidth={1.8}
              />
              {!encogida && <span className="truncate">{etiqueta}</span>}

              {aviso > 0 && (
                <span
                  aria-label={textoPendientes(aviso)}
                  className={clsx(
                    // Naranja suave, como en la propuesta, y no relleno: es un
                    // recuento, no una acción, y el naranja lleno es del botón
                    // de cada pantalla. Sobre el marcador (que es del mismo
                    // naranja suave) pasa a blanco para no desaparecer.
                    'flex items-center justify-center rounded-full font-bold text-accent-foreground tabular-nums',
                    esActiva ? 'bg-surface' : 'bg-accent',
                    encogida
                      ? // Plegado no cabe al lado del icono: se monta en la
                        // esquina, como el número del panel.
                        'absolute top-0.5 right-1 h-[15px] min-w-[15px] px-1 text-[9.5px]'
                      : 'ml-auto h-[18px] min-w-[18px] px-1.5 text-micro',
                  )}
                >
                  {aviso}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ---------- El pie ---------- */}
      <div
        className={clsx(
          'flex flex-none flex-col gap-0.5 border-t border-border pt-2 pb-3',
          encogida ? 'px-2' : 'px-3',
        )}
      >
        {/* La portada en otra pestaña: quien la abre desde aquí quiere mirar
            cómo la ve una iglesia que llega, no irse del admin. */}
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={encogida ? 'Ver la portada' : undefined}
          aria-label={encogida ? 'Ver la portada' : undefined}
          className={filaPie}
        >
          <ExternalLink className="size-[17px] flex-none" strokeWidth={1.8} />
          {!encogida && 'Ver la portada'}
        </a>

        <button
          type="button"
          onClick={alternarAncho}
          title={encogida ? 'Desplegar el menú' : undefined}
          aria-label={encogida ? 'Desplegar el menú' : undefined}
          aria-expanded={!encogida}
          className={filaPie}
        >
          {encogida ? (
            <PanelLeftOpen className="size-[17px] flex-none" strokeWidth={1.8} />
          ) : (
            <PanelLeftClose className="size-[17px] flex-none" strokeWidth={1.8} />
          )}
          {!encogida && 'Plegar el menú'}
        </button>
      </div>
    </aside>
  );
}
