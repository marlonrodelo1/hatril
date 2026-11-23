'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useRef, useState } from 'react';
import {
  BookMarked,
  BookOpen,
  CalendarDays,
  MessagesSquare,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * Las pestañas del área del miembro.
 *
 * EL CUARTO HUECO, Y LAS TRES COSAS QUE VIVIERON EN ÉL
 * ----------------------------------------------------
 * Ahora es «Biblia». Antes fueron dos que se fueron por el mismo motivo,
 * repetir algo que ya estaba a la vista:
 *
 *   - **«Mi cuenta».** La cabecera de todas las pantallas de `/mi` lleva el
 *     avatar arriba a la derecha, que abre el mismo menú.
 *   - **El «+» de publicar.** Duró una tanda. La primera pantalla del muro ya
 *     tiene el disparador «¿Qué quieres compartir?» con su icono de foto, así
 *     que el botón de abajo hacía exactamente lo mismo dos dedos más abajo. En
 *     Instagram el «+» tiene sentido porque su primera pantalla NO trae
 *     compositor; copiar el patrón sin copiar el motivo es como se llena una
 *     barra de botones que se pisan.
 *
 * Y una tercera que duró literalmente un commit: «Panel», para devolver al
 * equipo a su sección. Resolvía un agujero real —al quitar la flecha de volver
 * de la cabecera, un pastor que entraba al muro se quedaba sin salida— pero lo
 * resolvía en el sitio equivocado: la barra es la navegación del MIEMBRO, y la
 * vuelta al panel es una cosa de cuenta. Vive en el menú del avatar, junto a
 * «Tus datos» y «Suscripción».
 *
 * CUATRO Y NO SIETE
 * -----------------
 * En la conversación salieron siete destinos: comunidad, devocional, eventos,
 * ministerios, mi perfil, la web de la iglesia y donar. En un móvil de 360px no
 * caben siete pestañas con texto legible, y una barra que hay que leer con
 * cuidado deja de ser una barra.
 *
 * Se quedan las que se usan CADA SEMANA. «Agenda» junta los eventos de la
 * iglesia y los ensayos de los ministerios porque para un miembro son la misma
 * pregunta —qué tengo yo esta semana—, y separarlas obliga a mirar en dos sitios
 * para contestarla. La web de la iglesia y Donar viven dentro del menú de la
 * cuenta, que es donde se buscan las cosas que se usan una vez al mes.
 *
 * UNA SOLA BARRA FIJA, Y NO DOS
 * -----------------------------
 * El primer intento eran dos: una pegada abajo en móvil y otra en fila arriba
 * para escritorio. No funciona, y el motivo es estructural: esto vive en el
 * layout, y cada página de `/mi` pinta su propia cabecera pegajosa. Una barra
 * superior puesta por el layout sale SIEMPRE encima de esa cabecera, que es el
 * orden equivocado, y arreglarlo obligaba a subir las tres cabeceras al layout
 * —tres páginas con requisitos distintos, incluida `/mi/avisos`, que funciona
 * sin membresía—.
 *
 * Con una sola barra `fixed` el orden del DOM deja de importar.
 *
 * FLOTANTE Y CON GLASEADO, PERO SIN SOMBRA Y SIN LIBRERÍA
 * -------------------------------------------------------
 * La referencia que pidió Marlon era un componente de shadcn con `framer-motion`,
 * sombras de dos capas, clases `dark:` y los nombres escondidos tras un tooltip
 * al pasar el ratón. Lo que se ha traído de ahí es el ASPECTO —pastilla flotante
 * translúcida— y no la implementación, por cuatro razones que están en las reglas
 * de este repo:
 *
 *   1. `framer-motion` no entra: el brief dice «sin librerías de animación
 *      pesadas», y lo único que animaba era el tooltip que aquí no existe.
 *   2. Sin sombras. La regla 3 del sistema de diseño es que la profundidad se
 *      hace con bordes de 1px, y una sombra de 16px aquí desentonaría con las
 *      otras cuarenta pantallas.
 *   3. Sin `dark:`. Hatril es modo claro únicamente y no se inventa una paleta.
 *   4. **Los nombres se ven siempre.** En la referencia el nombre sale al pasar
 *      el ratón, y en un móvil no hay ratón: serían tres dibujos sin nombre en
 *      la pantalla principal de la aplicación.
 *
 * El glaseado no es nuevo aquí: es el mismo `supports-[backdrop-filter]` que ya
 * usa `CabeceraMiembro`. Va con guarda porque un navegador sin `backdrop-filter`
 * se queda con el fondo translúcido y el texto encima ilegible; con la guarda,
 * ese caso cae a un fondo sólido.
 */

const PESTANAS = [
  { href: '/mi/comunidad', etiqueta: 'Comunidad', Icono: MessagesSquare },
  { href: '/mi/devocional', etiqueta: 'Devocional', Icono: BookOpen },
  { href: '/mi/agenda', etiqueta: 'Agenda', Icono: CalendarDays },
  { href: '/mi/biblia', etiqueta: 'Biblia', Icono: BookMarked },
] as const;



/*
 * LA QUINTA, SOLO PARA QUIEN SIRVE EN UN EQUIPO
 * ---------------------------------------------
 * «Equipo» es lo de sus equipos: quien lleva uno encuentra ahí sus
 * herramientas sin salir al panel, y el voluntario, sus turnos, el ensayo y la
 * lista del domingo sin tener que adivinar dónde buscarlos. Sale al final y
 * solo a quien sirve en algo, así que el miembro que no sirve en nada sigue
 * viendo sus cuatro pestañas exactamente donde estaban, y nadie pierde ninguna
 * de las suyas de sitio.
 *
 * Cinco caben a 375 px: «Comunidad», la más larga, mide unos 55 px a 10.5 y a
 * cada pestaña le tocan unos 68. Seis ya no. Por eso la emisora va encima de la
 * barra y no como pestaña (`docs/modulos/plan.md`, §6).
 *
 * El destino lo calcula el layout: con un solo ministerio, su portada directa,
 * sin pasar por la lista. `raiz` es lo que decide cuándo está encendida, que es
 * en cualquier pantalla de la zona.
 */
const EQUIPO = {
  etiqueta: 'Equipo',
  Icono: Users,
  raiz: '/mi/equipo',
} as const;

export function BarraInferior({
  equipo,
}: {
  /** A dónde lleva «Equipo». Sin él, la pestaña no se pinta. */
  equipo?: string | null;
}) {
  const pathname = usePathname();

  /*
   * LA PASTILLA QUE VIAJA (base común, 17-nov)
   *
   * El fondo de la pestaña elegida es una pieza aparte que se desliza a la
   * nueva al cambiar de pantalla, en vez de saltar. La barra vive en el layout
   * y no se vuelve a montar al navegar: basta con medir la pestaña marcada.
   * Hasta medirla (el primer pintado), la pestaña lleva el fondo ella misma.
   */
  const navRef = useRef<HTMLElement>(null);
  const [pastilla, setPastilla] = useState<{
    x: number;
    y: number;
    ancho: number;
    alto: number;
  } | null>(null);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const medir = () => {
      const act = nav.querySelector<HTMLElement>('a[aria-current="page"]');
      setPastilla(
        act
          ? {
              x: act.offsetLeft,
              y: act.offsetTop,
              ancho: act.offsetWidth,
              alto: act.offsetHeight,
            }
          : null,
      );
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(nav);
    return () => observador.disconnect();
  }, [pathname, equipo]);

  /*
   * LO QUE OCUPA LA BARRA, PARA QUIEN SE PONE ENCIMA
   *
   * La radio va pegada encima de la barra, y en `/mi` hay piezas fijas abajo
   * (la barra de acciones de la Biblia, «Guardar la lista»…) que tienen que
   * quedar por encima. En vez de que cada una adivine el alto de la barra —que
   * cambia con la zona segura de cada móvil y con el tamaño de letra—, la barra
   * lo mide y lo publica como `--alto-barra-mi` en la raíz: la distancia del
   * borde de abajo de la pantalla al borde de arriba de la barra. El hueco del
   * final de cada pantalla (`mi/layout.tsx`) también la usa.
   */
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const raiz = document.documentElement;
    const publicar = () => {
      const caja = nav.getBoundingClientRect();
      const ocupa = Math.ceil(window.innerHeight - caja.top);
      raiz.style.setProperty('--alto-barra-mi', `${ocupa}px`);
    };
    publicar();
    const observador = new ResizeObserver(publicar);
    observador.observe(nav);
    window.addEventListener('resize', publicar);
    return () => {
      observador.disconnect();
      window.removeEventListener('resize', publicar);
      raiz.style.removeProperty('--alto-barra-mi');
    };
  }, []);

  return (
    <nav
      ref={navRef}
      aria-label="Secciones"
      className={
        /*
         * ANCLADA ABAJO EN EL MÓVIL (zona 2, 17-nov)
         *
         * Flotaba a 12 px de los bordes y Marlon la veía «desplazada arriba, no
         * anclada abajo del dispositivo». Ahora, en el móvil, va pegada al
         * borde de abajo y de lado a lado, como la barra de cualquier app
         * nativa: una sola raya arriba, y la zona segura del iPhone dentro de
         * su relleno de abajo para que la barra de gestos no se coma la fila.
         * En escritorio sigue siendo la pastilla centrada y flotante.
         */
        'fixed inset-x-0 bottom-0 z-30 flex items-center gap-1 border-t border-border px-1.5 pt-1.5 ' +
        /*
         * «SALE RECORTADA POR EL TELÉFONO» (19-nov, en el iPhone)
         *
         * El viewport no pide `viewport-fit=cover`, así que iOS deja la web
         * DENTRO de la zona segura y pinta la franja de la barra de gestos con
         * el fondo del WebView, el crema (`backgroundColor` de
         * `capacitor.config.ts`); `env(safe-area-inset-bottom)` vale 0. La
         * barra, en blanco, se cortaba en seco justo encima de esa franja
         * crema, con las etiquetas pegadas al borde. Ahora es del mismo crema
         * que la franja —se leen como una sola barra hasta el borde del
         * teléfono— y lleva más aire debajo de las etiquetas. Si un día se
         * pide `viewport-fit=cover`, el `env()` ya está puesto.
         */
        'pb-[calc(0.625rem+env(safe-area-inset-bottom))] ' +
        /*
         * El glaseado, con guarda: sin `backdrop-filter` el fondo translúcido
         * dejaría el texto ilegible sobre lo que haya debajo.
         *
         * MÁS CRISTAL DESDE QUE EL MURO TIENE COLOR
         * -----------------------------------------
         * Con el muro entero en crema, un glaseado no se distingue de un fondo
         * sólido: no hay nada detrás que difuminar. Desde que el versículo del
         * día es un bloque verde, al pasar por debajo se ve el color a través
         * del cristal — así que baja la opacidad, sube el desenfoque y entra
         * `backdrop-saturate`, que revive el color que atraviesa en vez de
         * dejarlo lavado.
         *
         * Era 0.7 en oscuro. En crema sube a 0.92, y es un número medido, no
         * un gusto: el caso peor es una foto casi negra pasando por debajo, y
         * con el blanco al 70 % el texto gris de las pestañas se queda en 2.4:1.
         * Al 92 % da 4.56. Las pestañas miden 10.5px: necesitan 4.5 enteros.
         */
        // Crema en el móvil (ver arriba), al 96 % y no al 92: el crema es un
        // pelo más oscuro que el blanco y las etiquetas tienen que seguir en
        // 4.5:1 con una foto negra pasando por debajo. En escritorio, la
        // pastilla sigue en blanco.
        'bg-background supports-backdrop-filter:bg-background/96 md:bg-surface md:supports-backdrop-filter:bg-surface/92 supports-backdrop-filter:backdrop-blur-2xl supports-backdrop-filter:backdrop-saturate-150 ' +
        // Escritorio: pastilla centrada del ancho de su contenido.
        'md:inset-x-auto md:bottom-5 md:left-1/2 md:w-auto md:-translate-x-1/2 md:rounded-2xl md:border md:p-1.5'
      }
    >
      {pastilla && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 left-0 rounded-lg border border-primary/30 bg-accent transition-[transform,width] duration-240 ease-hatril motion-reduce:transition-none"
          style={{
            width: pastilla.ancho,
            height: pastilla.alto,
            transform: `translate(${pastilla.x}px, ${pastilla.y}px)`,
          }}
        />
      )}
      {PESTANAS.map((p) => (
        <Pestana
          key={p.href}
          pestana={p}
          pathname={pathname}
          conPastilla={pastilla !== null}
        />
      ))}
      {equipo && (
        <Pestana
          pestana={{ ...EQUIPO, href: equipo }}
          pathname={pathname}
          conPastilla={pastilla !== null}
        />
      )}
    </nav>
  );
}

function Pestana({
  pestana: p,
  pathname,
  conPastilla,
}: {
  pestana: { href: string; etiqueta: string; Icono: LucideIcon; raiz?: string };
  pathname: string;
  /** Con la pastilla ya medida, el fondo lo pone ella y no la pestaña. */
  conPastilla: boolean;
}) {
  const raiz = p.raiz ?? p.href;
  const esta = pathname === raiz || pathname.startsWith(`${raiz}/`);

  return (
    <Link
      href={p.href}
      aria-current={esta ? 'page' : undefined}
      className={
        /*
         * 11,5 px y no 10,5: el mínimo de la escala (inventario, A16).
         *
         * CADA PESTAÑA, DEL ANCHO DE SU NOMBRE
         * Con las cinco del mismo ancho (`flex-1`) no caben: medido con la
         * letra de verdad, «Comunidad» ocupa 65 px y «Devocional» 63, y a 360
         * px a cada pestaña le tocan 62. Se pegaban («ComunidadDevocional»,
         * lo vio Marlon el 17-nov). Con `flex-auto` cada una parte del ancho
         * de su nombre y el sobrante se reparte: «Biblia» (31 px) y «Equipo»
         * (39) ceden lo que les sobra, y las cinco caben con aire hasta en un
         * móvil de 320 px. La pastilla mide la pestaña, así que sigue bien.
         *
         * `relative` para quedar encima de la pastilla, que va antes en el DOM.
         */
        'relative flex min-w-0 flex-auto flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-micro font-semibold whitespace-nowrap no-underline transition-colors duration-150 hover:no-underline ' +
        'md:flex-none md:flex-row md:gap-2 md:px-3 md:py-2 md:text-[13.5px] ' +
        (esta
          /*
           * NARANJA SUAVE Y OPACO
           *
           * Pasó por tres versiones antes: `bg-accent` casi invisible, naranja
           * relleno con letra blanca —un botón pegado dentro de otro botón— y,
           * en oscuro, naranja al 22 % translúcido. A Marlon no le gustaba ese
           * naranja, y con la paleta de Claude vuelve a ser el fondo suave
           * `accent` (#F5E7DF), ahora con borde para que se distinga.
           *
           * Opaco y no translúcido: con un velo, el color de la pestaña depende
           * de lo que pase por debajo, y el contraste del texto también. La letra
           * es `accent-foreground` (#92442A, 5.6:1 sobre este fondo) y no el
           * naranja de marca, que sobre su propio fondo suave se queda en 4.15.
           */
          ? conPastilla
            ? 'border border-transparent text-accent-foreground hover:text-accent-foreground'
            : 'border border-primary/30 bg-accent text-accent-foreground'
          : 'border border-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground')
      }
    >
      <p.Icono
        className="size-[19px] md:size-4"
        strokeWidth={esta ? 2.1 : 1.7}
        aria-hidden
      />
      {p.etiqueta}
    </Link>
  );
}
