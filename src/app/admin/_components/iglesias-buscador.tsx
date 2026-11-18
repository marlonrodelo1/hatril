'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';

import { Input } from '@/components/ui/input';

/**
 * El buscador del listado de iglesias, con su botón de borrar.
 *
 * Es un formulario GET de toda la vida: sin JavaScript, se escribe, se pulsa
 * Intro y la página vuelve filtrada por `?q=`, que es además lo que usa el
 * buscador Ctrl K para traer hasta aquí «Buscar «x» en Iglesias». Con
 * JavaScript filtra mientras se escribe, con una pausa de 300 ms para no pedir
 * una página por letra.
 *
 * El filtro y el orden viajan en campos ocultos: buscar no debe devolver la
 * tabla a «Todas, por fecha de alta».
 *
 * La equis es un enlace a la misma página sin `q`, así que también borra sin
 * JavaScript; con él, además, vacía el campo sin esperar y le devuelve el foco.
 * La del navegador se oculta: con las dos, `type="search"` enseñaba dos equis.
 */
const PAUSA_MS = 300;

export function BuscadorIglesias({
  q,
  ocultos,
  base,
}: {
  q: string;
  /** Lo que se conserva al buscar: `ver`, `orden`, `dir`. */
  ocultos: Record<string, string>;
  base: string;
}) {
  const router = useRouter();
  const campo = useRef<HTMLInputElement>(null);
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [texto, setTexto] = useState(q);

  const urlCon = (busqueda: string) => {
    const p = new URLSearchParams(ocultos);
    const limpio = busqueda.trim();
    if (limpio) p.set('q', limpio);
    const s = p.toString();
    return s ? `${base}?${s}` : base;
  };

  const parar = () => {
    if (reloj.current) clearTimeout(reloj.current);
    reloj.current = null;
  };

  useEffect(() => parar, []);

  // Si `q` cambia desde fuera —el buscador Ctrl K estando ya aquí—, el campo lo
  // recoge. Solo cuando no se está escribiendo en él: mientras se escribe, la
  // página que llega es la de hace 300 ms, y pisar el campo con ella se comería
  // las letras tecleadas después.
  useEffect(() => {
    if (document.activeElement !== campo.current) setTexto(q);
  }, [q]);

  const ir = (busqueda: string) => {
    parar();
    router.replace(urlCon(busqueda), { scroll: false });
  };

  return (
    <form
      method="get"
      action={base}
      role="search"
      className="relative w-full md:w-[320px]"
      onSubmit={(e) => {
        e.preventDefault();
        ir(texto);
      }}
    >
      {Object.entries(ocultos).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.8}
      />
      <Input
        ref={campo}
        name="q"
        type="search"
        value={texto}
        onChange={(e) => {
          const valor = e.target.value;
          setTexto(valor);
          parar();
          reloj.current = setTimeout(() => ir(valor), PAUSA_MS);
        }}
        placeholder="Nombre, ciudad o dirección"
        aria-label="Buscar iglesias"
        autoComplete="off"
        // 36 de alto, el de una barra de filtros (guía, «Formulario»).
        className="h-9 pr-9 pl-9 [&::-webkit-search-cancel-button]:appearance-none"
      />
      {texto && (
        <Link
          href={urlCon('')}
          scroll={false}
          aria-label="Borrar la búsqueda"
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground no-underline transition-colors duration-150 hover:bg-surface-active hover:text-foreground motion-reduce:transition-none"
          onClick={(e) => {
            e.preventDefault();
            setTexto('');
            ir('');
            campo.current?.focus();
          }}
        >
          <X className="size-4" strokeWidth={1.8} aria-hidden />
        </Link>
      )}
    </form>
  );
}
