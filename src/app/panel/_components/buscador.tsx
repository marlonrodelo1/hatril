'use client';

import { useRouter } from 'next/navigation';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { Dialog } from '@base-ui/react/dialog';
import {
  CalendarPlus,
  CornerDownLeft,
  ExternalLink,
  Search,
  UserPlus,
} from 'lucide-react';
import { clsx } from 'clsx';

import type { Bloque } from '@/lib/panel/secciones';
import type { FlagsDelMenu } from '@/lib/panel/menu';

/**
 * El buscador del panel: Ctrl K (⌘K en el Mac) desde cualquier pantalla.
 *
 * NUEVO EN LA BASE COMÚN (17-nov)
 * -------------------------------
 * Marlon lo aprobó en la pieza de navegación, marcado como novedad. Sirve para
 * ir a una sección o hacer algo sin recorrer el menú.
 *
 * NO ABRE NINGÚN CAMINO NUEVO A LOS DATOS
 * ---------------------------------------
 * Lo que ofrece sale de lo que la persona ya tiene a mano:
 *   - las secciones de su menú, que `construirMenu` ya filtró por permisos;
 *   - unas pocas acciones, solo si sus permisos las dejan (`flags`);
 *   - «Buscar … en Miembros», que lleva a `/panel/miembros?q=…`, la misma
 *     búsqueda de esa pantalla con su misma guarda.
 * No busca personas por su cuenta: eso sería una consulta nueva a datos de
 * categoría especial, con su guarda y su prueba de aislamiento, y no hacía
 * falta para que el atajo sirviera.
 */
type Opcion = {
  clave: string;
  grupo: 'Ir a' | 'Hacer' | 'Buscar';
  etiqueta: string;
  icono: ReactNode;
  href: string;
  nuevaPestana?: boolean;
};

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const nada = () => () => {};

export function Buscador({
  bloques,
  flags,
  webIglesia,
  encogida,
}: {
  bloques: Bloque[];
  flags: FlagsDelMenu;
  webIglesia: string | null;
  encogida: boolean;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [elegida, setElegida] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  // El atajo que se enseña depende del sistema, y el servidor no lo sabe:
  // pinta «Ctrl K» y el Mac lo cambia al hidratar.
  const atajo = useSyncExternalStore(
    nada,
    () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘K' : 'Ctrl K'),
    () => 'Ctrl K',
  );

  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setTexto('');
        setElegida(0);
        setAbierto((a) => !a);
      }
    };
    window.addEventListener('keydown', alPulsar);
    return () => window.removeEventListener('keydown', alPulsar);
  }, []);

  const fijas = useMemo<Opcion[]>(() => {
    const secciones: Opcion[] = bloques.flatMap((b) =>
      b.secciones.map((s) => ({
        clave: `ir:${s.href}`,
        grupo: 'Ir a' as const,
        etiqueta: s.etiqueta,
        href: s.href,
        icono: s.Icono ? (
          <s.Icono className="size-4" strokeWidth={1.8} />
        ) : (
          <span className="size-2 rounded-full" style={{ backgroundColor: s.punto }} />
        ),
      })),
    );
    const acciones: Opcion[] = [
      ...(flags.puedeEditarMiembros
        ? [
            {
              clave: 'hacer:miembro',
              grupo: 'Hacer' as const,
              etiqueta: 'Añadir miembro',
              href: '/panel/miembros/nuevo',
              icono: <UserPlus className="size-4" strokeWidth={1.8} />,
            },
          ]
        : []),
      ...(flags.puedeVerEventos
        ? [
            {
              clave: 'hacer:evento',
              grupo: 'Hacer' as const,
              etiqueta: 'Nuevo evento',
              href: '/panel/eventos/nuevo',
              icono: <CalendarPlus className="size-4" strokeWidth={1.8} />,
            },
          ]
        : []),
      ...(webIglesia
        ? [
            {
              clave: 'hacer:web',
              grupo: 'Hacer' as const,
              etiqueta: 'Ver la web de la iglesia',
              href: webIglesia,
              nuevaPestana: true,
              icono: <ExternalLink className="size-4" strokeWidth={1.8} />,
            },
          ]
        : []),
    ];
    return [...secciones, ...acciones];
  }, [bloques, flags, webIglesia]);

  const opciones = useMemo<Opcion[]>(() => {
    const q = sinAcentos(texto.trim());
    const encontradas = q
      ? fijas.filter((o) => sinAcentos(o.etiqueta).includes(q))
      : fijas;
    if (texto.trim().length < 2) return encontradas;
    return [
      ...encontradas,
      {
        clave: 'buscar:miembros',
        grupo: 'Buscar' as const,
        etiqueta: `«${texto.trim()}» en Miembros`,
        href: `/panel/miembros?q=${encodeURIComponent(texto.trim())}`,
        icono: <Search className="size-4" strokeWidth={1.8} />,
      },
    ];
  }, [fijas, texto]);

  const indice = Math.min(elegida, Math.max(0, opciones.length - 1));

  function ir(o: Opcion | undefined) {
    if (!o) return;
    setAbierto(false);
    if (o.nuevaPestana) window.open(o.href, '_blank', 'noopener,noreferrer');
    else router.push(o.href);
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const siguiente =
        e.key === 'ArrowDown'
          ? Math.min(opciones.length - 1, indice + 1)
          : Math.max(0, indice - 1);
      setElegida(siguiente);
      listaRef.current
        ?.querySelector(`[data-indice="${siguiente}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      ir(opciones[indice]);
    }
  }

  return (
    <Dialog.Root
      open={abierto}
      onOpenChange={(a) => {
        setAbierto(a);
        if (a) {
          setTexto('');
          setElegida(0);
        }
      }}
    >
      <Dialog.Trigger
        title={encogida ? `Buscar (${atajo})` : undefined}
        className={clsx(
          'flex h-9 w-full cursor-pointer items-center gap-[11px] rounded-md text-[13.5px] font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-surface-alt hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20',
          encogida ? 'justify-center px-0' : 'px-3',
        )}
      >
        <Search className="size-[17px] flex-none" strokeWidth={1.7} />
        {!encogida && (
          <>
            <span className="flex-1 text-left">Buscar</span>
            <kbd className="rounded-[5px] border border-border bg-surface-alt px-1.5 py-0.5 font-sans text-micro font-semibold text-muted-foreground">
              {atajo}
            </kbd>
          </>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-velo data-closed:animate-out data-closed:fade-out-0 data-open:animate-in data-open:fade-in-0" />
        <Dialog.Popup className="fixed top-[12vh] left-1/2 z-50 flex max-h-[70vh] w-[min(560px,calc(100vw-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-surface outline-none data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <Dialog.Title className="sr-only">Buscar en el panel</Dialog.Title>
          <div className="flex flex-none items-center gap-2.5 border-b border-border px-4">
            <Search className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.7} />
            <input
              autoFocus
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setElegida(0);
              }}
              onKeyDown={alTeclear}
              placeholder="Ir a una sección, hacer algo o buscar a alguien…"
              aria-label="Buscar"
              className="h-13 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded-[5px] border border-border bg-surface-alt px-1.5 py-0.5 font-sans text-micro font-semibold text-muted-foreground">
              Esc
            </kbd>
          </div>

          <div ref={listaRef} className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
            {opciones.length === 0 && (
              <p className="px-3 py-8 text-center text-body text-muted-foreground">
                Nada con «{texto}». Prueba con otra palabra.
              </p>
            )}
            {opciones.map((o, i) => {
              const cabecera = i === 0 || opciones[i - 1]?.grupo !== o.grupo;
              return (
                <div key={o.clave} className="flex flex-col">
                  {cabecera && <span className="t-micro px-3 pt-2.5 pb-1">{o.grupo}</span>}
                  <button
                    type="button"
                    data-indice={i}
                    onMouseMove={() => setElegida(i)}
                    onClick={() => ir(o)}
                    className={clsx(
                      'flex h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-body outline-none',
                      i === indice ? 'bg-surface-alt' : '',
                    )}
                  >
                    <span className="flex size-7 flex-none items-center justify-center rounded-md border border-border bg-surface text-support">
                      {o.icono}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                    {i === indice && (
                      <CornerDownLeft
                        className="size-4 flex-none text-muted-foreground"
                        strokeWidth={1.8}
                        aria-hidden
                      />
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="flex flex-none gap-4 border-t border-border px-4 py-2.5 text-micro font-semibold text-muted-foreground normal-case">
            <span>↑ ↓ para moverte</span>
            <span>Enter para abrir</span>
            <span>Esc para cerrar</span>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
