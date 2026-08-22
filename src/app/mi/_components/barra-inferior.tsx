'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  MessagesSquare,
} from 'lucide-react';

/**
 * Las pestañas del área del miembro.
 *
 * TRES, Y EL CUARTO HUECO SE QUEDA VACÍO A PROPÓSITO
 * --------------------------------------------------
 * Aquí han vivido dos cosas que se fueron, y las dos por el mismo motivo:
 * repetían algo que ya estaba a la vista.
 *
 *   - **«Mi cuenta».** La cabecera de todas las pantallas de `/mi` lleva el
 *     avatar arriba a la derecha, que abre el mismo menú.
 *   - **El «+» de publicar.** Duraba una tanda. La primera pantalla del muro ya
 *     tiene el disparador «¿Qué quieres compartir?» con su icono de foto, así
 *     que el botón de abajo hacía exactamente lo mismo dos dedos más abajo. Lo
 *     dijo Marlon en cuanto lo vio, y tenía razón.
 *
 * En Instagram el «+» tiene sentido porque su primera pantalla NO trae
 * compositor: hay que ir a otro sitio para publicar. Aquí sí lo trae, y copiar
 * el patrón sin copiar el motivo es como se llena una barra de botones que se
 * pisan.
 *
 * El cuarto hueco estuvo vacío un rato, esperando un destino de verdad en vez de
 * rellenarse por rellenarse. Lo ocupa «Panel», y SOLO para quien es del equipo:
 * no repite nada —el panel no está en ningún otro sitio de `/mi`— y resuelve un
 * agujero que abrimos nosotros. Al quitar la flecha de volver de la cabecera, un
 * pastor que entraba al muro se quedaba sin ninguna forma de salir.
 *
 * Para el miembro raso siguen siendo tres: él no tiene panel al que volver.
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
] as const;

/**
 * La vuelta al panel, solo para el equipo.
 *
 * Fuera de `PESTANAS` porque no es una sección de `/mi`: es la puerta de salida.
 * Y va la última a propósito — la de más a la derecha es la que menos se pulsa
 * sin querer, y esta saca de la aplicación en la que estás.
 */
const AL_PANEL = {
  href: '/panel/hoy',
  etiqueta: 'Panel',
  Icono: LayoutDashboard,
} as const;

export function BarraInferior({
  esDelEquipo = false,
}: {
  /**
   * Pastor, secretaría, tesorería o líder. Les aparece la cuarta pestaña, que
   * les devuelve al panel — la única salida que tienen desde aquí desde que la
   * cabecera perdió la flecha de volver.
   */
  esDelEquipo?: boolean;
}) {
  const pathname = usePathname();

  const pestanas = esDelEquipo ? [...PESTANAS, AL_PANEL] : PESTANAS;

  return (
    <nav
      aria-label="Secciones"
      className={
        // Flotante en las dos anchuras. `bottom-[calc(...)]` respeta la zona
        // segura del iPhone: pegada a `bottom-3` a secas, la barra de gestos se
        // come la fila de abajo.
        'fixed inset-x-3 z-30 flex items-center gap-1 rounded-2xl border border-border p-1.5 ' +
        'bottom-[calc(0.75rem+env(safe-area-inset-bottom))] ' +
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
         * No baja de 0.7: por debajo, el texto de las pestañas empieza a
         * pelearse con una foto del domingo que pase por detrás.
         */
        'bg-surface supports-backdrop-filter:bg-surface/70 supports-backdrop-filter:backdrop-blur-2xl supports-backdrop-filter:backdrop-saturate-150 ' +
        // Escritorio: pastilla centrada del ancho de su contenido.
        'md:inset-x-auto md:bottom-5 md:left-1/2 md:w-auto md:-translate-x-1/2'
      }
    >
      {pestanas.map((p) => (
        <Pestana key={p.href} pestana={p} pathname={pathname} />
      ))}
    </nav>
  );
}

function Pestana({
  pestana: p,
  pathname,
}: {
  pestana: (typeof PESTANAS)[number] | typeof AL_PANEL;
  pathname: string;
}) {
  const esta = pathname === p.href || pathname.startsWith(`${p.href}/`);

  return (
    <Link
      href={p.href}
      aria-current={esta ? 'page' : undefined}
      className={
        'flex flex-1 flex-col items-center gap-1 rounded-xl py-2 text-[11px] font-semibold no-underline hover:no-underline ' +
        'md:flex-none md:flex-row md:gap-2 md:px-3.5 md:text-[14px] ' +
        (esta
          // `bg-accent` era el rosa palo de los hover, no el naranja de marca: la
          // pestaña activa apenas se distinguía de las otras dos. `primary` SÍ
          // es el naranja, y aquí no rompe la regla del único botón naranja
          // por pantalla porque esto no es un botón, es dónde estás.
          ? 'bg-primary text-white'
          : 'text-muted-foreground hover:bg-background/60 hover:text-foreground')
      }
    >
      <p.Icono
        className="size-[21px] md:size-4"
        strokeWidth={esta ? 2 : 1.7}
        aria-hidden
      />
      {p.etiqueta}
    </Link>
  );
}
