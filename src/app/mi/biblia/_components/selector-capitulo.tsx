'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

import type { Libro } from '@/lib/biblia/libros';
import { Hoja } from '@/components/hoja';
import { RejillaCapitulos } from './rejilla-capitulos';

/**
 * «Salmos 23 ⌄»: el nombre del capítulo, que abre la rejilla de capítulos.
 *
 * POR QUÉ
 * -------
 * Para ir del 23 al 91 había que volver a la pantalla del libro, buscar el
 * número y entrar otra vez. En Salmos, con 150, eso es lo que más se hace
 * (zona 2 del rediseño, 17-nov). Ahora el propio título es el selector, como
 * en cualquier lector de la Biblia, y la rejilla sube en una hoja sin salir
 * del capítulo.
 *
 * Es el `<h2>` de la pantalla con el botón dentro, y no al revés: un botón no
 * puede contener un encabezado, y así el lector de pantalla anuncia las dos
 * cosas, «Salmos 23, encabezado» y «botón».
 *
 * Sin JavaScript el botón no hace nada, y no pasa nada: la flecha de la
 * cabecera lleva a la misma rejilla, en su pantalla.
 */
export function SelectorCapitulo({
  libro,
  capitulo,
}: {
  libro: Pick<Libro, 'slug' | 'nombre' | 'capitulos'>;
  capitulo: number;
}) {
  const [abierta, setAbierta] = useState(false);

  return (
    <>
      <h2 className="t-titulo">
        <button
          type="button"
          onClick={() => setAbierta(true)}
          aria-haspopup="dialog"
          aria-expanded={abierta}
          className="-ml-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-0.5 text-left outline-none transition-colors duration-150 hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20 motion-reduce:transition-none"
        >
          {libro.nombre} {capitulo}
          <ChevronDown
            aria-hidden
            strokeWidth={1.8}
            className={clsx(
              'size-5 flex-none text-muted-foreground transition-transform duration-240 ease-hatril motion-reduce:transition-none',
              abierta && 'rotate-180',
            )}
          />
        </button>
      </h2>

      <Hoja
        abierta={abierta}
        onCambio={setAbierta}
        titulo={`${libro.nombre} · elige capítulo`}
        descripcion={`Los ${libro.capitulos} capítulos de ${libro.nombre}. Estás en el ${capitulo}.`}
      >
        {/*
         * Al abrir, el capítulo actual al centro de la hoja: en el Salmo 119,
         * la rejilla empieza en el 1 y el 119 queda veinte filas más abajo,
         * fuera de la vista. Va en el `ref` porque la hoja se monta al abrirse.
         */}
        <div
          ref={(caja) => {
            caja
              ?.querySelector('[aria-current="page"]')
              ?.scrollIntoView({ block: 'center' });
          }}
          className="pb-[env(safe-area-inset-bottom)]"
        >
          <RejillaCapitulos
            libro={libro}
            actual={capitulo}
            alElegir={() => setAbierta(false)}
          />
        </div>
      </Hoja>
    </>
  );
}
