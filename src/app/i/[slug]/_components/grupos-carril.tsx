'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { List } from 'lucide-react';
import { clsx } from 'clsx';

import { Hoja } from '@/components/hoja';
import { Button } from '@/components/ui/button';

export type GrupoCarril = {
  id: string;
  nombre: string;
  descripcion: string | null;
  fotoUrl: string | null;
  /** Ya resueltos con `colorDeMinisterio` en el servidor. */
  suave: string;
  claro: string;
};

/**
 * Los grupos de la iglesia: un carril en el móvil y una rejilla en escritorio.
 *
 * POR QUÉ SE FUE LA BARAJA
 * ------------------------
 * Antes cada grupo era una tarjeta de pantalla entera que se quedaba pegada al
 * bajar (`position: sticky`). Bonito con tres; con los nueve de Betania eran
 * casi cuatro mil píxeles en el móvil, cinco pantallazos, la sección más larga
 * de la web con diferencia. Y los grupos sin foto eran cajas de color enormes
 * con el nombre abajo y nada más. Marlon aprobó el cambio el 17-nov (zona 3).
 *
 * EL CARRIL ES EL DESPLAZAMIENTO NATIVO
 * -------------------------------------
 * `overflow-x: auto` con `scroll-snap`: el navegador hace el arrastre, la
 * inercia y el encaje, igual en un Android de gama baja que en un iPhone. El
 * único JavaScript es el de los puntos de abajo, que solo leen `scrollLeft`.
 * Cada tarjeta mide algo menos que el ancho para que asome la siguiente: sin
 * eso, nada dice que el carril sigue.
 *
 * En escritorio el mismo marcado se convierte en una rejilla de doce
 * columnas: primero los grupos con foto, de dos en dos, y debajo los demás en
 * filas de hasta cuatro. Ver `anchosEnEscritorio` para cómo se reparten sin
 * dejar ninguno solo en su fila.
 */
export function GruposCarril({ grupos }: { grupos: GrupoCarril[] }) {
  const carril = useRef<HTMLUListElement>(null);
  const [activo, setActivo] = useState(0);
  const [lista, setLista] = useState(false);
  const anchos = anchosEnEscritorio(grupos);

  useEffect(() => {
    const el = carril.current;
    if (!el) return;
    let cuadro = 0;
    // `requestAnimationFrame` para no recalcular más de una vez por fotograma:
    // `scroll` llega muchas veces seguidas mientras el dedo arrastra.
    const leer = () => {
      cancelAnimationFrame(cuadro);
      cuadro = requestAnimationFrame(() => {
        const primera = el.firstElementChild as HTMLElement | null;
        if (!primera) return;
        const paso = primera.offsetWidth + 12;
        // Al llegar al final, el último punto, aunque la última tarjeta no
        // quepa a la izquierda: si no, el carril acaba y el punto se queda
        // en el penúltimo.
        const alFinal = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4;
        setActivo(alFinal ? grupos.length - 1 : Math.round(el.scrollLeft / paso));
      });
    };
    el.addEventListener('scroll', leer, { passive: true });
    return () => {
      el.removeEventListener('scroll', leer);
      cancelAnimationFrame(cuadro);
    };
  }, [grupos.length]);

  return (
    <div className="flex flex-col gap-4">
      {/*
       * `-mx-4 px-4`: el carril llega a los bordes de la pantalla y la primera
       * tarjeta sigue alineada con el título. `scroll-px-4` hace que encaje
       * ahí y no pegada al borde.
       *
       * `tabIndex` y `role="region"`: sin foco, quien usa teclado no puede
       * desplazar un carril que no tiene botones.
       */}
      <ul
        ref={carril}
        role="region"
        aria-label="Grupos y ministerios"
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 outline-none [scrollbar-width:none] focus-visible:ring-3 focus-visible:ring-ring/20 sm:-mx-5 sm:scroll-px-5 sm:px-5 md:mx-0 md:grid md:grid-cols-12 md:gap-4 md:overflow-visible md:px-0 md:pb-0 [&::-webkit-scrollbar]:hidden"
      >
        {grupos.map((g) => (
          <li
            key={g.id}
            // `gridColumn` en línea porque el ancho sale de una cuenta; en el
            // móvil la lista es `flex` y lo ignora.
            style={{ gridColumn: `span ${anchos.get(g.id) ?? 3}` }}
            className={clsx(
              'relative flex h-[320px] w-[78%] max-w-[300px] flex-none snap-start flex-col overflow-hidden rounded-2xl border md:w-auto md:max-w-none',
              g.fotoUrl
                ? 'justify-end border-transparent md:order-1 md:h-[280px]'
                : 'justify-between border-border bg-surface md:order-2 md:h-[220px]',
            )}
          >
            {g.fotoUrl ? (
              <>
                <Image
                  src={g.fotoUrl}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 300px, 560px"
                  className="object-cover transition-transform duration-360 ease-hatril motion-safe:hover:scale-[1.03]"
                />
                {/* El mismo velo plano que la portada y por lo mismo: el texto
                    blanco tiene que leerse sobre cualquier foto, también una
                    clara. Sin degradado: el sistema no los usa. */}
                <div aria-hidden className="absolute inset-0 bg-black/55" />
              </>
            ) : (
              /* Sin foto, la inicial en su color en vez de una caja vacía. La
                 letra va en `claro` y no en `hex`: `claro` es el tono que
                 `colores.ts` mide contra el fondo suave. */
              <span
                aria-hidden
                className="m-4 flex size-14 items-center justify-center rounded-2xl text-[24px] font-extrabold"
                style={{ background: g.suave, color: g.claro }}
              >
                {g.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}

            <div className="relative flex flex-col gap-1.5 p-4 md:p-5">
              <h3
                className={clsx(
                  'text-pretty text-[21px] font-extrabold leading-tight tracking-[-0.02em]',
                  g.fotoUrl ? 'text-white' : 'text-foreground',
                )}
              >
                {g.nombre}
              </h3>
              {g.descripcion && (
                <p
                  className={clsx(
                    'line-clamp-4 text-pretty text-[14px] leading-relaxed',
                    g.fotoUrl ? 'text-white/90' : 'text-muted-foreground',
                  )}
                >
                  {g.descripcion}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Los puntos y la lista entera solo en el móvil: en escritorio la
          rejilla ya enseña todos los grupos a la vez. */}
      {grupos.length > 1 && (
        <div className="flex items-center justify-between gap-3 md:hidden">
          <div aria-hidden className="flex items-center gap-1.5">
            {grupos.map((g, i) => (
              <span
                key={g.id}
                className={clsx(
                  'h-1.5 rounded-full transition-[width,background-color] duration-240 ease-hatril',
                  i === activo ? 'w-[18px] bg-foreground' : 'w-1.5 bg-border-strong',
                )}
              />
            ))}
          </div>

          <Button type="button" variant="outline" size="sm" onClick={() => setLista(true)}>
            <List strokeWidth={1.8} />
            Ver los {grupos.length}
          </Button>
        </div>
      )}

      <Hoja
        abierta={lista}
        onCambio={setLista}
        titulo={`Los ${grupos.length} grupos`}
        descripcion="Puedes sumarte a cualquiera. Se entra probando, sin compromiso."
      >
        <ul className="flex flex-col pb-2">
          {grupos.map((g) => (
            <li
              key={g.id}
              className="flex items-center gap-3 border-b border-border py-2.5 last:border-b-0"
            >
              <span
                aria-hidden
                className="relative flex size-11 flex-none items-center justify-center overflow-hidden rounded-xl bg-surface-active text-[17px] font-extrabold"
                style={g.fotoUrl ? undefined : { background: g.suave, color: g.claro }}
              >
                {g.fotoUrl ? (
                  <Image src={g.fotoUrl} alt="" fill sizes="44px" className="object-cover" />
                ) : (
                  g.nombre.trim().charAt(0).toUpperCase()
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] font-semibold">{g.nombre}</span>
                {g.descripcion && (
                  <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                    {g.descripcion}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Hoja>
    </div>
  );
}

/**
 * Cuántas de las doce columnas ocupa cada grupo en escritorio.
 *
 * Con un reparto fijo (foto a dos columnas de cuatro, el resto a una), los
 * nueve grupos de Betania dejaban «Ujieres y Protocolo» solo en la última fila,
 * con tres huecos al lado. Aquí las filas se equilibran: los de foto van de dos
 * en dos (si son impares, el último a todo el ancho) y los demás en filas de
 * hasta cuatro repartidas a partes iguales: cinco salen como tres y dos, no
 * como cuatro y uno.
 */
function anchosEnEscritorio(grupos: GrupoCarril[]): Map<string, number> {
  const anchos = new Map<string, number>();
  const conFoto = grupos.filter((g) => g.fotoUrl);
  const sinFoto = grupos.filter((g) => !g.fotoUrl);

  conFoto.forEach((g, i) => {
    const ultimoSolo = conFoto.length % 2 === 1 && i === conFoto.length - 1;
    anchos.set(g.id, ultimoSolo ? 12 : 6);
  });

  const filas = Math.ceil(sinFoto.length / 4);
  let i = 0;
  for (let fila = 0; fila < filas; fila++) {
    // Las primeras filas se llevan uno más cuando no salen exactas.
    const enEsta =
      Math.floor(sinFoto.length / filas) + (fila < sinFoto.length % filas ? 1 : 0);
    for (let k = 0; k < enEsta; k++) anchos.set(sinFoto[i++]!.id, 12 / enEsta);
  }

  return anchos;
}
