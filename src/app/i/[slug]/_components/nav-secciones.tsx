'use client';

import { useRef, useState } from 'react';

/**
 * El menú de secciones de la web pública, con la píldora que sigue al ratón.
 *
 * SIN `framer-motion`
 * -------------------
 * La animación es mover dos números —`left` y `width`— de un elemento absoluto.
 * Eso lo hace CSS con `transition` en una línea. Traer una librería de
 * animación entera para esto son decenas de kilobytes de JavaScript en la
 * página que más visitas sueltas recibe, y muchas desde un móvil con mala
 * cobertura mientras alguien busca a qué hora es el culto.
 *
 * QUÉ SE CAMBIÓ DEL DISEÑO ORIGINAL
 * ---------------------------------
 * El componente de referencia usaba `border-2 border-black`, `bg-white` y
 * `mix-blend-difference`. Aquí los bordes son de 1px y los colores salen de los
 * tokens: la píldora es `accent-soft`, la misma que marca la sección activa en
 * el panel. El efecto es el mismo; lo que cambia es que se parece al resto del
 * producto.
 *
 * El ratón es lo único que mueve la píldora. En móvil no hay hover y no pasa
 * nada: los enlaces siguen siendo enlaces.
 */
export function NavSecciones({
  secciones,
}: {
  secciones: { href: string; texto: string }[];
}) {
  const lista = useRef<HTMLUListElement>(null);
  const [pildora, setPildora] = useState({ left: 0, width: 0, visible: false });

  function seguir(nodo: HTMLElement) {
    const contenedor = lista.current;
    if (!contenedor) return;
    // `offsetLeft` es relativo al contenedor posicionado, que es la propia lista.
    // Con `getBoundingClientRect` habría que restar la del padre y compensar el
    // scroll de la página, y la píldora se descolocaría al hacer scroll.
    setPildora({ left: nodo.offsetLeft, width: nodo.offsetWidth, visible: true });
  }

  return (
    <ul
      ref={lista}
      // La cápsula también en cristal, pero MENOS desenfoque que la cabecera:
      // van una encima de otra y con el mismo valor se sumarían hasta borrar lo
      // que pasa por debajo, que es justo lo que se quería enseñar.
      className="relative flex w-fit items-center rounded-full border border-border bg-surface-alt supports-[backdrop-filter]:bg-surface-alt/70 supports-[backdrop-filter]:backdrop-blur-md p-1"
      onMouseLeave={() => setPildora((p) => ({ ...p, visible: false }))}
    >
      {/*
       * La píldora va DETRÁS de los enlaces, y el texto de encima cambia a
       * blanco al pasar el ratón. El componente original resolvía lo mismo con
       * `mix-blend-difference`, que invierte el color contra lo que tenga
       * debajo; aquí no hace falta y además se evita el efecto secundario de
       * ese modo, que también invierte el fondo de la cabecera al desplazarse.
       *
       * Va en verde `support` y no en el naranja de marca porque en esta misma
       * cabecera ya está el botón «Cómo llegar», y el sistema de diseño admite
       * un solo naranja por pantalla: dos peleándose y ninguno destaca.
       */}
      <li
        aria-hidden="true"
        className="pointer-events-none absolute z-0 h-9 rounded-full bg-support transition-[left,width,opacity] duration-300 ease-out"
        style={{
          left: pildora.left,
          width: pildora.width,
          opacity: pildora.visible ? 1 : 0,
        }}
      />

      {secciones.map((s) => (
        <li key={s.href} className="relative z-10">
          <a
            href={s.href}
            onMouseEnter={(e) => seguir(e.currentTarget.parentElement!)}
            onFocus={(e) => seguir(e.currentTarget.parentElement!)}
            className="block whitespace-nowrap rounded-full px-4 py-2 text-[12.5px] font-bold uppercase tracking-[0.06em] text-muted-foreground no-underline transition-colors hover:text-white hover:no-underline focus-visible:text-white"
          >
            {s.texto}
          </a>
        </li>
      ))}
    </ul>
  );
}
