'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useSyncExternalStore } from 'react';
import { ChevronRight, ExternalLink, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

import { construirMenu } from '@/lib/panel/secciones';
import { MarcaIglesia } from './marca-iglesia';
import type { FlagsDelMenu } from '@/lib/panel/menu';

/**
 * El menú lateral del panel, solo en escritorio. En móvil lo sustituye
 * `menu-movil.tsx`, que sale de la cabecera y usa el MISMO `construirMenu`.
 *
 * POR QUÉ BLOQUES Y NO UNA LISTA SEGUIDA
 * --------------------------------------
 * A un pastor le salen once entradas de un tirón, y once cosas sin agrupar se
 * leen una a una cada vez que hay que encontrar algo. Con encabezado —«La
 * congregación», «La vida de la iglesia», «Administración»— se salta al bloque
 * y dentro hay tres o cuatro. Los bloques se pliegan y el estado se recuerda,
 * pero el que contiene la página abierta se abre solo: plegar el menú no puede
 * esconder dónde estás.
 *
 * POR QUÉ SE PUEDE ENCOGER A UNA COLUMNA DE ICONOS
 * -----------------------------------------------
 * 264 px de menú fijo son un 20% de un portátil de 1280. En las pantallas
 * anchas de verdad no molesta, pero en un portátil normal, con una tabla de
 * miembros al lado, ese ancho es la diferencia entre ver tres columnas y ver
 * cinco. Encogida deja 64 px y el panel gana el resto.
 *
 * QUÉ SE FUE DE AQUÍ
 * ------------------
 * El pie con las iniciales, el nombre y el botón de salir. Era un `<span>`
 * inerte junto a un icono, y ahora todo eso —más los datos de la cuenta y la
 * contraseña, que no existían— vive en el menú de cuenta de la cabecera. Dos
 * sitios con el avatar de la misma persona en la misma pantalla es uno de más.
 */

/** Se recuerda entre visitas: quien encoge el menú lo quiere encogido siempre. */
const CLAVE_ENCOGIDA = 'hatril:panel:menu-encogido';
const CLAVE_PLEGADOS = 'hatril:panel:menu-plegados';

/*
 * El `localStorage` leído como lo que es: un sistema externo a React.
 *
 * La primera versión lo leía en un `useEffect` con `setState` dentro, y el lint
 * de React lo rechaza con razón —cada carga del panel provocaba un segundo
 * render en cascada—. `useSyncExternalStore` resuelve las dos cosas de golpe:
 * el servidor recibe el valor por defecto (menú ancho, todo desplegado) y el
 * cliente el guardado, sin discordancia de hidratación y sin render de más.
 *
 * El evento `storage` entra en la suscripción para el pastor que tiene el panel
 * abierto en dos pestañas: encoge el menú en una y la otra le sigue.
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

export function PanelSidebar({
  flags,
  iglesiaNombre,
  iglesiaCiudad,
  iglesiaIniciales,
  iglesiaLogo,
  webIglesia,
}: {
  flags: FlagsDelMenu;
  iglesiaNombre: string;
  iglesiaCiudad: string | null;
  iglesiaIniciales: string;
  /** Su logo, o null si todavía no ha subido ninguno. */
  iglesiaLogo: string | null;
  /** Su web pública, o null si todavía no la ha publicado. */
  webIglesia: string | null;
}) {
  const pathname = usePathname();

  /*
   * `getSnapshot` tiene que devolver algo estable entre llamadas o React entra
   * en bucle: por eso el crudo se lee como cadena y el `JSON.parse` —que
   * fabrica un array nuevo cada vez— va detrás, memorizado.
   */
  const encogida = useSyncExternalStore(
    suscribir,
    () => window.localStorage.getItem(CLAVE_ENCOGIDA) === 'si',
    () => false,
  );

  const plegadosCrudo = useSyncExternalStore(
    suscribir,
    () => window.localStorage.getItem(CLAVE_PLEGADOS),
    () => null,
  );

  const plegados = useMemo<string[]>(() => {
    if (!plegadosCrudo) return [];
    try {
      const lista: unknown = JSON.parse(plegadosCrudo);
      return Array.isArray(lista)
        ? lista.filter((x) => typeof x === 'string')
        : [];
    } catch {
      // Un valor corrupto no puede dejar el menú sin pintar. Se ignora.
      return [];
    }
  }, [plegadosCrudo]);

  function alternarAncho() {
    guardar(CLAVE_ENCOGIDA, encogida ? 'no' : 'si');
  }

  function alternarBloque(titulo: string) {
    const siguiente = plegados.includes(titulo)
      ? plegados.filter((t) => t !== titulo)
      : [...plegados, titulo];
    guardar(CLAVE_PLEGADOS, JSON.stringify(siguiente));
  }

  const bloques = construirMenu(flags);

  // `startsWith` para que la ficha de un miembro (`/panel/miembros/…`) mantenga
  // Miembros marcado. Con igualdad exacta, entrar en una ficha apaga el menú
  // entero y no se sabe dónde se está.
  const estaActiva = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  return (
    <aside
      className={
        'sticky top-0 z-20 hidden h-dvh flex-none flex-col border-r border-border bg-surface transition-[width] duration-200 md:flex ' +
        (encogida ? 'w-[64px]' : 'w-[264px]')
      }
    >
      {/* ---------- La iglesia ---------- */}
      <div
        className={
          'flex items-center gap-[11px] border-b border-border py-4 ' +
          (encogida ? 'flex-col px-2' : 'px-4')
        }
      >
        <MarcaIglesia
          logoUrl={iglesiaLogo}
          iniciales={iglesiaIniciales}
          nombre={iglesiaNombre}
        />

        {!encogida && (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-[14.5px] font-bold leading-none tracking-[-0.015em]">
              {iglesiaNombre}
            </span>
            {iglesiaCiudad && (
              <span className="truncate text-[12px] leading-none text-muted-foreground">
                {iglesiaCiudad}
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={alternarAncho}
          title={encogida ? 'Ensanchar el menú' : 'Encoger el menú'}
          aria-label={encogida ? 'Ensanchar el menú' : 'Encoger el menú'}
          aria-expanded={!encogida}
          className="flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          {encogida ? (
            <PanelLeftOpen className="size-[17px]" strokeWidth={1.6} />
          ) : (
            <PanelLeftClose className="size-[17px]" strokeWidth={1.6} />
          )}
        </button>
      </div>

      {/* ---------- El menú ---------- */}
      <nav
        className={
          'flex flex-1 flex-col gap-4 overflow-y-auto py-3 ' +
          (encogida ? 'px-2' : 'px-3')
        }
      >
        {bloques.map((bloque, i) => {
          // Un bloque plegado que contiene la página abierta se abre igual: si
          // no, la única marca de dónde estás desaparece del menú.
          const contieneLaActiva = bloque.secciones.some((s) =>
            estaActiva(s.href),
          );
          const abierto =
            // Encogida no hay encabezados que pulsar, así que tampoco puede
            // haber bloques plegados: se vio en pantalla —«La vida de la
            // iglesia» plegado y luego el menú encogido dejaba Eventos,
            // Devocionales y Comunidad sin ninguna forma de volver a sacarlos.
            encogida ||
            !bloque.titulo ||
            contieneLaActiva ||
            !plegados.includes(bloque.titulo);

          return (
            <div key={bloque.titulo ?? i} className="flex flex-col gap-0.5">
              {bloque.titulo && !encogida && (
                <button
                  type="button"
                  onClick={() => alternarBloque(bloque.titulo!)}
                  aria-expanded={abierto}
                  className="mb-1 flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1 text-left text-muted-foreground transition-colors hover:text-foreground"
                >
                  <span className="t-micro">{bloque.titulo}</span>
                  <ChevronRight
                    className={
                      'size-3 transition-transform duration-200 ' +
                      (abierto ? 'rotate-90' : '')
                    }
                    strokeWidth={2.4}
                  />
                </button>
              )}

              {/* Encogida no hay encabezados que pulsar, así que un separador
                  fino hace de frontera entre bloques. */}
              {bloque.titulo && encogida && (
                <span className="mx-2 mb-1.5 h-px bg-border" />
              )}

              {/*
               * El plegado se anima con `grid-template-rows` de 1fr a 0fr en vez
               * de con `height`, que no se puede animar hacia «lo que mida el
               * contenido» sin medirlo en JavaScript.
               */}
              <div
                className={
                  'grid transition-[grid-template-rows] duration-200 ease-in-out ' +
                  (abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
                }
              >
                <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                  {bloque.secciones.map(({ href, etiqueta, Icono, aviso }) => {
                    const activa = estaActiva(href);

                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={activa ? 'page' : undefined}
                        title={encogida ? etiqueta : undefined}
                        tabIndex={abierto ? undefined : -1}
                        className={
                          'group relative flex h-9 items-center gap-[11px] rounded-md text-[13.5px] no-underline transition-colors hover:no-underline ' +
                          (encogida ? 'justify-center px-0' : 'px-3') +
                          ' ' +
                          (activa
                            ? 'bg-accent font-semibold text-accent-foreground'
                            : 'font-medium text-muted-foreground hover:bg-background hover:text-foreground')
                        }
                      >
                        <Icono
                          className={
                            'size-[17px] flex-none transition-colors ' +
                            (activa
                              ? ''
                              : 'text-muted-foreground group-hover:text-foreground')
                          }
                          strokeWidth={1.7}
                        />
                        {!encogida && (
                          <span className="truncate">{etiqueta}</span>
                        )}

                        {aviso > 0 && (
                          <span
                            // El texto del aria-label dice qué cuenta el número.
                            // Un «3» suelto en un lector de pantalla no significa
                            // nada.
                            aria-label={`${aviso} sin revisar`}
                            className={
                              'flex items-center justify-center rounded-full bg-primary font-bold text-primary-foreground tabular-nums ' +
                              (encogida
                                ? // Encogida no cabe al lado del icono: se monta
                                  // en la esquina, como el punto de una app del
                                  // móvil.
                                  'absolute right-1.5 top-1 size-[15px] text-[9.5px]'
                                : 'ml-auto min-w-[20px] px-1.5 py-0.5 text-[11px]')
                            }
                          >
                            {aviso}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* El enlace a su propia web, solo si está publicada. Lleva a un sitio
          fuera del panel, así que se abre en otra pestaña: quien lo pulsa quiere
          MIRAR cómo ha quedado, no irse. */}
      {webIglesia && (
        <a
          href={webIglesia}
          target="_blank"
          rel="noopener noreferrer"
          title={encogida ? 'Ver la web de la iglesia' : undefined}
          className={
            'mb-3 flex h-9 flex-none items-center justify-center gap-2 rounded-lg border border-border bg-surface-alt text-[13px] font-semibold text-foreground no-underline transition-colors hover:bg-background hover:no-underline ' +
            (encogida ? 'mx-2 px-0' : 'mx-3')
          }
        >
          <ExternalLink className="size-[15px] flex-none" strokeWidth={1.8} />
          {!encogida && 'Ver la web de la iglesia'}
        </a>
      )}
    </aside>
  );
}
