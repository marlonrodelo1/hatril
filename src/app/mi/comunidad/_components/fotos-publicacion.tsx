'use client';

import { useCallback, useState } from 'react';
import { clsx } from 'clsx';

import { Hoja } from '@/components/hoja';

/**
 * Las fotos de una publicación, en mosaico.
 *
 * Una foto, entera. Dos, en dos columnas. Tres o más, una grande a la izquierda
 * y dos a la derecha, con «+N» sobre la última si quedan más (zona 2 del
 * rediseño, aprobada el 17-nov). Antes iban en una rejilla de dos columnas
 * cuadradas: con cuatro fotos, la publicación medía dos pantallazos de alto.
 *
 * POR QUÉ AHORA SE ABREN, SI ANTES NO SE ABRÍAN
 * ---------------------------------------------
 * Antes cada foto era un `<img>` suelto y no se podía tocar, pero tampoco hacía
 * falta: se veían todas. Con el mosaico, la cuarta queda debajo del «+1», y un
 * «+1» que no lleva a ningún sitio es un número que promete algo que la
 * pantalla no da. Así que tocar el mosaico abre una hoja con todas, en su
 * orden, y empieza por la que se ha tocado.
 *
 * Es la misma `Hoja` de los comentarios y del «…», no un visor a pantalla
 * completa: no hay librería de galería que meter ni gesto que inventar.
 *
 * `<img>` Y NO `next/image`
 * -------------------------
 * Estas URLs vienen firmadas y caducan en una hora. El optimizador de Next las
 * descargaría y las guardaría en su caché con una clave que incluye la firma:
 * la misma foto se reoptimizaría entera cada vez que la firma cambia, y el
 * disco del contenedor se llenaría de copias que ya no sirven.
 */
export function FotosPublicacion({ urls }: { urls: string[] }) {
  const [abierta, setAbierta] = useState(false);
  const [desde, setDesde] = useState(0);

  const total = urls.length;
  const visibles = urls.slice(0, 3);
  const resto = total - visibles.length;

  /*
   * Llevar la hoja hasta la foto que se tocó.
   *
   * No vale con medir al montar: las fotos de antes todavía no saben su alto
   * —un `<img>` sin cargar mide cero— y el salto se quedaría corto. `decode()`
   * espera a que cada una esté lista para pintarse, que con las del mosaico es
   * casi inmediato porque ya están en la caché.
   *
   * Se mueve la caja que desplaza DENTRO de la hoja, nunca la página: es lo
   * que sostiene que al cerrar sigas en el mismo sitio del muro.
   */
  const alMontarLista = useCallback(
    (lista: HTMLUListElement | null) => {
      if (!lista || desde === 0) return;
      const fotos = Array.from(lista.querySelectorAll('img')).slice(0, desde);
      void Promise.all(fotos.map((f) => f.decode().catch(() => undefined))).then(
        () => {
          const destino = lista.children[desde];
          const caja = cajaQueDesplaza(lista);
          if (!destino || !caja) return;
          caja.scrollTop +=
            destino.getBoundingClientRect().top -
            caja.getBoundingClientRect().top -
            12;
        },
      );
    },
    [desde],
  );

  function abrir(i: number) {
    setDesde(i);
    setAbierta(true);
  }

  return (
    <>
      <div
        className={clsx(
          'grid gap-0.5',
          total === 1 && 'grid-cols-1',
          total === 2 && 'grid-cols-2',
          // Alto fijo por proporción y filas iguales: las fotos van en
          // absoluto dentro de su celda, así que ninguna estira la rejilla con
          // su tamaño natural.
          total >= 3 && 'aspect-[4/3] grid-cols-[2fr_1fr] grid-rows-2',
        )}
      >
        {visibles.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => abrir(i)}
            aria-label={
              i === visibles.length - 1 && resto > 0
                ? `Ver las ${total} fotos`
                : total === 1
                  ? 'Ver la foto'
                  : `Ver la foto ${i + 1} de ${total}`
            }
            className={clsx(
              'relative block cursor-pointer overflow-hidden bg-surface-active outline-none focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring',
              total === 2 && 'aspect-square',
              total >= 3 && i === 0 && 'row-span-2',
            )}
          >
            {/*
             * La foto sola lleva un alto mínimo. Sin él, mientras no ha
             * llegado —o si la firma caducó— un `<img>` sin tamaño mide cero y
             * la tarjeta se cierra sobre sí misma; con él queda la caja gris
             * del fondo. Las del mosaico no lo necesitan: su celda ya tiene
             * alto por proporción.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              loading="lazy"
              className={
                total === 1
                  ? 'block max-h-[520px] min-h-48 w-full object-cover'
                  : 'absolute inset-0 size-full object-cover'
              }
            />

            {i === visibles.length - 1 && resto > 0 && (
              /* Blanco sobre negro al 55 % porque va ENCIMA DE UNA FOTO, el
                 único sitio donde el sistema los deja. Con una foto blanca
                 entera debajo, el peor caso, el fondo queda en gris medio y el
                 blanco da 4,7:1. */
              <span
                aria-hidden
                className="absolute inset-0 flex items-center justify-center bg-black/55 text-subtitle font-bold text-white"
              >
                +{resto}
              </span>
            )}
          </button>
        ))}
      </div>

      <Hoja
        abierta={abierta}
        onCambio={setAbierta}
        titulo={total === 1 ? 'La foto' : `${total} fotos`}
        descripcion="Las fotos de esta publicación, una debajo de otra."
      >
        <ul ref={alMontarLista} className="flex flex-col gap-3 pb-1">
          {urls.map((url) => (
            <li key={url}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                className="block w-full rounded-lg border border-border bg-surface-active"
              />
            </li>
          ))}
        </ul>
      </Hoja>
    </>
  );
}

/** El primer antepasado que desplaza: el cuerpo de la hoja. */
function cajaQueDesplaza(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(p).overflowY)) return p;
  }
  return null;
}
