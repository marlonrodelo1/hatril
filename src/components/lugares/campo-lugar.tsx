'use client';

import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { clsx } from 'clsx';
import { MapPin, MapPinOff } from 'lucide-react';

import { Input } from '@/components/ui/input';

/**
 * Una dirección con sugerencias de Google mientras se escribe.
 *
 * Lo usan «cerca de una dirección» (web y app) y la dirección de Ajustes. Las
 * sugerencias las pide a nuestro servidor, no a Google (`lib/lugares/google.ts`
 * dice por qué); `desde` es la base de esas rutas: `/api/v1/lugares` en la web
 * y `https://hatril.com/api/v1/app/lugares` en la app.
 *
 * LA SESIÓN
 * ---------
 * Google cobra las sugerencias de una misma búsqueda como una sola sesión si
 * van con el mismo token y acaban en un detalle. El token nace al escribir la
 * primera letra que busca y se tira al elegir.
 *
 * Solo busca lo que se TECLEA: al elegir, el campo se rellena con la dirección
 * y eso no debe volver a abrir la lista.
 */
export type LugarElegido = {
  id: string;
  /** Lo que se eligió, como se vio en la lista: «Calle 45 #12-30». */
  texto: string;
  /** La dirección completa de Google. */
  direccion: string;
  ciudad: string | null;
  latitud: number;
  longitud: number;
};

type Sugerencia = { id: string; principal: string; secundario: string | null };

const ERROR_GENERICO = 'No hemos podido buscar la dirección. Inténtalo otra vez en un momento.';

function nuevaSesion(): string {
  const c = globalThis.crypto;
  if (c && 'randomUUID' in c) return c.randomUUID();
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function pedirJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, { headers: { Accept: 'application/json' }, cache: 'no-store', signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error('No hay conexión. Comprueba tu internet y vuelve a intentarlo.');
  }
  const cuerpo = (await r.json().catch(() => null)) as { error?: string } | null;
  if (!r.ok) throw new Error(cuerpo?.error ?? ERROR_GENERICO);
  return cuerpo as T;
}

export function CampoLugar({
  desde,
  id,
  name,
  defaultValue = '',
  placeholder,
  onElegir,
  onCambiar,
  describedBy,
  grande = false,
  maxLength = 240,
}: {
  desde: string;
  id: string;
  /** Con `name`, el texto viaja en el formulario (la dirección de Ajustes). */
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  onElegir: (lugar: LugarElegido) => void;
  /** Cada vez que cambia el texto, a mano o al elegir. */
  onCambiar?: (texto: string) => void;
  describedBy?: string;
  /** El campo alto con icono de las pantallas de buscar iglesia. */
  grande?: boolean;
  maxLength?: number;
}) {
  const [texto, setTexto] = useState(defaultValue);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [abierto, setAbierto] = useState(false);
  const [activa, setActiva] = useState(-1);
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [haciaArriba, setHaciaArriba] = useState(false);
  const sesion = useRef<string | null>(null);
  const tecleado = useRef(false);
  const caja = useRef<HTMLDivElement>(null);
  const idLista = useId();

  /**
   * Hacia dónde se abre la lista: hacia arriba si debajo del campo no cabe.
   *
   * En «cerca de mí» el campo está al pie de la pantalla, y con el teclado
   * del teléfono abierto lo de debajo no se ve: la lista quedaba tapada (se
   * vio a 375 px). `visualViewport` mide lo que queda visible con el teclado
   * fuera; sin él, la ventana entera.
   */
  function abrir() {
    const r = caja.current?.getBoundingClientRect();
    if (r) {
      const alto = window.visualViewport?.height ?? window.innerHeight;
      const debajo = alto - r.bottom;
      setHaciaArriba(debajo < 260 && r.top > debajo);
    }
    setAbierto(true);
  }

  useEffect(() => {
    if (!tecleado.current) return;
    const q = texto.trim();
    // Por debajo de tres letras no se busca; la lista ya la cerró `cambiar`.
    if (q.length < 3) return;
    const control = new AbortController();
    // 300 ms sin teclear: una sugerencia por pausa, no por letra.
    const espera = setTimeout(async () => {
      sesion.current ??= nuevaSesion();
      setBuscando(true);
      try {
        const r = await pedirJson<{ sugerencias: Sugerencia[] }>(
          `${desde}/sugerencias?q=${encodeURIComponent(q)}&sesion=${sesion.current}`,
          control.signal,
        );
        setSugerencias(r.sugerencias);
        setActiva(-1);
        abrir();
        setError(null);
      } catch (e) {
        if (control.signal.aborted) return;
        setAbierto(false);
        setError(e instanceof Error ? e.message : ERROR_GENERICO);
      } finally {
        if (!control.signal.aborted) setBuscando(false);
      }
    }, 300);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
  }, [texto, desde]);

  function cambiar(valor: string) {
    tecleado.current = true;
    setTexto(valor);
    onCambiar?.(valor);
    if (valor.trim().length < 3) {
      setSugerencias([]);
      setAbierto(false);
    }
  }

  async function elegir(s: Sugerencia) {
    tecleado.current = false;
    setAbierto(false);
    setTexto(s.principal);
    onCambiar?.(s.principal);
    setBuscando(true);
    setError(null);
    try {
      const token = sesion.current ? `&sesion=${sesion.current}` : '';
      const r = await pedirJson<{ lugar: Omit<LugarElegido, 'texto'> | null }>(
        `${desde}/detalle?id=${encodeURIComponent(s.id)}${token}`,
      );
      if (!r.lugar) {
        setError('No encontramos ese sitio. Prueba con otra dirección.');
        return;
      }
      onElegir({ ...r.lugar, texto: s.principal });
    } catch (e) {
      setError(e instanceof Error ? e.message : ERROR_GENERICO);
    } finally {
      // La sesión acaba con el detalle, haya ido bien o no.
      sesion.current = null;
      setBuscando(false);
    }
  }

  function teclas(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && abierto) {
      e.preventDefault();
      setAbierto(false);
      return;
    }
    if (!abierto || sugerencias.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiva((a) => (a + 1) % sugerencias.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiva((a) => (a <= 0 ? sugerencias.length - 1 : a - 1));
    } else if (e.key === 'Enter') {
      // Con la lista abierta, Intro elige (la primera si no se ha movido) y
      // no envía el formulario de Ajustes a medio escribir.
      e.preventDefault();
      void elegir(sugerencias[Math.max(activa, 0)]!);
    }
  }

  const idOpcion = (i: number) => `${idLista}-${i}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div ref={caja} className="relative">
        {grande && (
          <MapPin
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.8}
          />
        )}
        <Input
          id={id}
          name={name}
          value={texto}
          onChange={(e) => cambiar(e.target.value)}
          onKeyDown={teclas}
          onBlur={() => setAbierto(false)}
          onFocus={() => sugerencias.length > 0 && tecleado.current && abrir()}
          maxLength={maxLength}
          placeholder={placeholder}
          // Sin el autorrelleno del navegador: taparía la lista de Google.
          autoComplete="off"
          enterKeyHint="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierto}
          aria-controls={abierto ? idLista : undefined}
          aria-activedescendant={abierto && activa >= 0 ? idOpcion(activa) : undefined}
          aria-describedby={describedBy}
          aria-busy={buscando}
          className={clsx(grande && 'h-12 rounded-xl bg-surface pl-11')}
        />
        {abierto && (
          // `onPointerDown` sin acción por defecto: así tocar una sugerencia no
          // quita antes el foco del campo, que cerraría la lista sin elegir.
          <div
            onPointerDown={(e) => e.preventDefault()}
            className={clsx(
              'absolute inset-x-0 z-30 overflow-hidden rounded-xl border border-border bg-surface',
              haciaArriba ? 'bottom-full mb-1' : 'top-full mt-1',
            )}
          >
            {sugerencias.length > 0 ? (
              <ul id={idLista} role="listbox" aria-label="Direcciones sugeridas" className="max-h-72 overflow-y-auto py-1">
                {sugerencias.map((s, i) => (
                  <li
                    key={s.id}
                    id={idOpcion(i)}
                    role="option"
                    aria-selected={i === activa}
                    onClick={() => void elegir(s)}
                    className={clsx(
                      'flex cursor-pointer items-start gap-2.5 px-3.5 py-2.5',
                      i === activa ? 'bg-surface-active' : 'hover:bg-surface-alt',
                    )}
                  >
                    <MapPin aria-hidden className="mt-0.5 size-4 flex-none text-muted-foreground" strokeWidth={1.8} />
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[15px] font-semibold text-foreground">{s.principal}</span>
                      {s.secundario && (
                        <span className="text-[13px] text-muted-foreground">{s.secundario}</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p id={idLista} className="px-3.5 py-3 text-[14px] text-muted-foreground">
                No encontramos esa dirección. Prueba con el barrio o la ciudad.
              </p>
            )}
            {/* Google pide decir de dónde salen las sugerencias cuando no van
                encima de uno de sus mapas. */}
            <p className="border-t border-border px-3.5 py-1.5 text-right text-[11.5px] text-muted-foreground">
              Google Maps
            </p>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-[14px] text-danger">
          <MapPinOff aria-hidden className="size-4 flex-none" strokeWidth={1.8} />
          {error}
        </p>
      )}
    </div>
  );
}
