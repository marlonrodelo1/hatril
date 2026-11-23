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
import { CornerDownLeft, Search } from 'lucide-react';
import { clsx } from 'clsx';

import { BUSCABLES, SECCIONES } from './secciones';

/**
 * El buscador del super admin: Ctrl K (⌘K en el Mac) desde cualquier pantalla
 * de `/admin`. El mismo que el del panel de cada iglesia, aprobado en la zona 4.
 *
 * POR QUÉ UNO PROPIO Y NO EL DEL PANEL
 * ------------------------------------
 * `panel/_components/buscador.tsx` recibe los bloques de `construirMenu` y los
 * permisos de una iglesia, y lleva escritos dentro «Añadir miembro», «Nuevo
 * evento» y «Buscar en Miembros». Hacerlo servir aquí obligaba a cambiarle la
 * forma, y el panel no se toca por el admin. Este copia su manera de hacer
 * —el mismo diálogo, las mismas teclas, la misma fila elegida— con lo que tiene
 * sentido aquí.
 *
 * NO ABRE NINGÚN CAMINO NUEVO A LOS DATOS
 * ---------------------------------------
 * Ofrece las cuatro secciones y, al escribir, «Buscar «x» en Iglesias» y
 * «Buscar «x» en Cuentas», que llevan a `/admin/iglesias?q=x` y
 * `/admin/cuentas?q=x`: la búsqueda que esas pantallas ya hacen, con su guarda
 * de siempre. No busca iglesias ni cuentas por su cuenta: eso sería una
 * consulta nueva por `dbAdmin`, sin RLS debajo, para ahorrarse un clic.
 */
type Opcion = {
  clave: string;
  grupo: 'Secciones' | 'Buscar';
  etiqueta: string;
  icono: ReactNode;
  href: string;
};

function sinAcentos(texto: string) {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const nada = () => () => {};

const TECLAS: { teclas: string[]; que: string }[] = [
  { teclas: ['↑', '↓'], que: 'moverte' },
  { teclas: ['Enter'], que: 'abrir' },
  { teclas: ['Esc'], que: 'cerrar' },
];

const SECCIONES_FIJAS: Opcion[] = SECCIONES.map((s) => ({
  clave: `ir:${s.href}`,
  grupo: 'Secciones',
  etiqueta: s.etiqueta,
  href: s.href,
  icono: <s.Icono className="size-4" strokeWidth={1.8} />,
}));

export function BuscadorAdmin({ encogida }: { encogida: boolean }) {
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

  const opciones = useMemo<Opcion[]>(() => {
    const limpio = texto.trim();
    const q = sinAcentos(limpio);
    const secciones = q
      ? SECCIONES_FIJAS.filter((o) => sinAcentos(o.etiqueta).includes(q))
      : SECCIONES_FIJAS;
    // Con una letra ya se ofrece buscar, como en la propuesta aprobada: las
    // dos listas filtran desde el primer carácter y no hay consulta que
    // ahorrar, porque aquí no se consulta nada.
    if (!limpio) return secciones;
    const buscar: Opcion[] = SECCIONES.filter((s) => BUSCABLES.includes(s.href)).map(
      (s) => ({
        clave: `buscar:${s.href}`,
        grupo: 'Buscar',
        etiqueta: `Buscar «${limpio}» en ${s.etiqueta}`,
        href: `${s.href}?q=${encodeURIComponent(limpio)}`,
        icono: <s.Icono className="size-4" strokeWidth={1.8} />,
      }),
    );
    return [...secciones, ...buscar];
  }, [texto]);

  const indice = Math.min(elegida, Math.max(0, opciones.length - 1));

  function ir(o: Opcion | undefined) {
    if (!o) return;
    setAbierto(false);
    router.push(o.href);
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
        aria-label={encogida ? 'Buscar' : undefined}
        className={clsx(
          'flex h-9 w-full flex-none cursor-pointer items-center gap-[11px] rounded-md text-label font-medium text-muted-foreground transition-colors duration-150 outline-none hover:bg-surface-alt hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20',
          encogida ? 'justify-center px-0' : 'px-3',
        )}
      >
        <Search className="size-[17px] flex-none" strokeWidth={1.8} />
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
          <Dialog.Title className="sr-only">Buscar en la administración</Dialog.Title>
          <div className="flex flex-none items-center gap-2.5 border-b border-border px-4">
            <Search className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
            <input
              autoFocus
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value);
                setElegida(0);
              }}
              onKeyDown={alTeclear}
              placeholder="Busca una iglesia, una cuenta o una sección…"
              aria-label="Buscar"
              className="h-13 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded-[5px] border border-border bg-surface-alt px-1.5 py-0.5 font-sans text-micro font-semibold text-muted-foreground">
              Esc
            </kbd>
          </div>

          <div ref={listaRef} className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
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
                      i === indice && 'bg-surface-alt',
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

          {/* Las teclas en su cajita, como en la propuesta: se leen de un
              vistazo mejor que «para moverte» escrito. */}
          <div className="flex flex-none flex-wrap gap-x-4 gap-y-1 border-t border-border px-4 py-2.5 text-label text-muted-foreground">
            {TECLAS.map(({ teclas, que }) => (
              <span key={que} className="flex items-center gap-1">
                {teclas.map((t) => (
                  <kbd
                    key={t}
                    className="rounded-[5px] border border-border bg-surface-alt px-1.5 py-0.5 font-sans text-micro font-semibold text-muted-foreground"
                  >
                    {t}
                  </kbd>
                ))}
                <span className="ml-0.5">{que}</span>
              </span>
            ))}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
