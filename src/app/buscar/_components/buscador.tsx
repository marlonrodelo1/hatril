'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Church, Search } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { nombrePais } from './fila-iglesia';

/**
 * El buscador de «Ya pertenezco a una iglesia»: sugerencias mientras se
 * escribe y el botón «Buscar» para la lista entera.
 *
 * Lo pidió así Marlon el 19-nov, después de verlo en el iPhone: antes solo
 * buscaba al pulsar la tecla del teclado, y en el teléfono parecía que no
 * salía nada. Tocar una sugerencia lleva a la ficha de la iglesia, que es
 * donde está «Pedir unirme», igual que una fila de la lista.
 *
 * SIGUE SIENDO UN FORMULARIO GET
 * ------------------------------
 * «Buscar» envía `/buscar?q=`: la búsqueda es una URL, el botón atrás
 * funciona y, sin JavaScript, el buscador es el de antes con un botón. Las
 * sugerencias son lo único que necesita JavaScript.
 *
 * Sin `useEffect` que pida datos: se pide al escribir, con una pausa corta y
 * cancelando la petición anterior, para no lanzar una por letra.
 */

type Sugerencia = { slug: string; nombre: string; ciudad: string | null; pais: string };

const PAUSA_MS = 220;

export function BuscadorIglesias({ inicial }: { inicial: string }) {
  const [texto, setTexto] = useState(inicial);
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enCurso = useRef<AbortController | null>(null);
  const idLista = useId();

  // Al salir de la pantalla, nada pendiente que llegue tarde.
  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      enCurso.current?.abort();
    },
    [],
  );

  function alEscribir(valor: string) {
    setTexto(valor);
    if (temporizador.current) clearTimeout(temporizador.current);
    enCurso.current?.abort();

    const q = valor.trim();
    if (q.length < 2) {
      setSugerencias([]);
      return;
    }

    temporizador.current = setTimeout(async () => {
      const control = new AbortController();
      enCurso.current = control;
      try {
        const r = await fetch(`/api/v1/iglesias/sugerencias?q=${encodeURIComponent(q)}`, {
          signal: control.signal,
        });
        if (!r.ok) return;
        const datos = (await r.json()) as { sugerencias: Sugerencia[] };
        setSugerencias(datos.sugerencias);
      } catch {
        // Cancelada porque se siguió escribiendo, o sin red: el botón
        // «Buscar» sigue funcionando sin sugerencias.
      }
    }, PAUSA_MS);
  }

  const abierta = sugerencias.length > 0 && texto.trim().length >= 2;

  return (
    <form
      action="/buscar"
      role="search"
      className="flex flex-col gap-3"
      onSubmit={() => setSugerencias([])}
    >
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.8}
        />
        <input
          type="search"
          name="q"
          value={texto}
          onChange={(e) => alEscribir(e.target.value)}
          autoFocus={!inicial}
          maxLength={80}
          // La tecla del teclado del teléfono dice «Buscar».
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          placeholder="Nombre de la iglesia"
          aria-label="Nombre de la iglesia"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={abierta}
          aria-controls={idLista}
          className="h-12 w-full rounded-xl border border-input bg-surface pr-3.5 pl-11 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
        />
      </div>

      {abierta && (
        <ul
          id={idLista}
          role="listbox"
          aria-label="Sugerencias"
          className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface"
        >
          {sugerencias.map((s) => (
            <li key={s.slug} role="option" aria-selected={false} className="border-b border-border last:border-b-0">
              <Link
                href={`/iglesia/${s.slug}`}
                className="flex items-center gap-3 px-4 py-3 text-foreground no-underline outline-none hover:bg-surface-active focus-visible:bg-surface-active"
              >
                <Church aria-hidden className="size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-[15.5px] font-semibold">{s.nombre}</span>
                  <span className="truncate text-[13.5px] text-muted-foreground">
                    {[s.ciudad, nombrePais(s.pais)].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Carbón y no naranja: en «no encontramos» el naranja es «Invitar a
          mi iglesia», y solo puede haber uno por pantalla. */}
      <Button type="submit" variant="secondary" size="lg" className="w-full">
        Buscar
      </Button>
    </form>
  );
}
