import {
  House,
  Users,
  HandHeart,
  Inbox,
  Settings,
  ShieldCheck,
  BookOpen,
  Wallet,
  CalendarDays,
  CalendarCheck,
  Share2,
  MessagesSquare,
  Blocks,
  type LucideIcon,
} from 'lucide-react';

import { colorDeMinisterio } from '@/lib/ministerios/colores';
import type { FlagsDelMenu } from './menu';

/**
 * El menú del panel, en bloques.
 *
 * Este fichero lo importan DOS componentes de cliente —el menú lateral y el
 * menú móvil—, así que no lleva `server-only` y no toca base de datos: recibe
 * los flags ya resueltos y devuelve estructura. Los iconos son referencias a
 * componentes de React y por eso se construyen aquí, en el cliente, y no se
 * pasan como props desde el servidor: un componente no es serializable y cruzar
 * esa frontera con uno dentro rompe el render.
 *
 * SOLO APARECE LO QUE FUNCIONA, Y SOLO A QUIEN PUEDE
 * --------------------------------------------------
 * El diseño dibuja ocho secciones: Inicio, Miembros, Ministerios, Eventos,
 * Finanzas, Seguimiento pastoral, Informes y Ajustes. Aquí están las que
 * existen. Un menú con enlaces que llevan a un 404 —o a un cartel de «pronto»—
 * hace parecer roto un producto que funciona.
 *
 * Y se recorta además por permisos: Solicitudes solo para quien puede
 * aprobarlas, Ajustes solo para el pastor. Una sección que al pulsarla rebota
 * con «no tienes acceso» parece un fallo del producto, no un permiso que falta.
 *
 * QUÉ SE FUE DE AQUÍ
 * ------------------
 * Avisos y Suscripción. Los avisos son ahora la campana de la cabecera, que es
 * donde se buscan; y Suscripción cuelga del menú de cuenta, junto a lo demás
 * que tiene que ver con pagar. Las dos rutas siguen existiendo.
 */

/**
 * Una entrada del menú: con icono o con punto de color, nunca las dos cosas.
 *
 * El punto es para los ministerios de «Lo que llevas». Cada uno tiene ya su
 * color en el fichero —el de su ficha y su etiqueta en Miembros—, y es lo que
 * los distingue de un vistazo; el mismo icono repetido tres veces no
 * distinguiría nada.
 */
export type Seccion = {
  href: string;
  etiqueta: string;
  aviso: number;
} & (
  | { Icono: LucideIcon; punto?: undefined }
  | { punto: string; Icono?: undefined }
);

export type Bloque = {
  /** Sin encabezado el bloque no se puede plegar: es el de arriba del todo. */
  titulo?: string;
  secciones: Seccion[];
};

/**
 * Qué entrada se marca para la ruta abierta: la de `href` más largo que la
 * contiene.
 *
 * Con «Lo que llevas», `/panel/ministerios/<id>/turnos` cae dentro de dos
 * entradas: la del ministerio y Ministerios. Marcar las dos dice que se está en
 * dos sitios a la vez, y además abre a la fuerza el bloque de la congregación.
 * Gana la más concreta. En el ministerio de otro equipo, que no tiene entrada
 * propia, sigue marcándose Ministerios.
 *
 * Contener y no coincidir, para que la ficha de un miembro (`/panel/miembros/…`)
 * mantenga Miembros marcado: con igualdad exacta, entrar en una ficha apaga el
 * menú entero y no se sabe dónde se está.
 *
 * Vive aquí y no en cada menú por lo mismo que `construirMenu`: escrita dos
 * veces, el día que cambie se cambiaría en uno solo.
 */
export function hrefActivo(bloques: Bloque[], pathname: string): string | null {
  let activo: string | null = null;

  for (const { secciones } of bloques) {
    for (const { href } of secciones) {
      const contiene = pathname === href || pathname.startsWith(`${href}/`);
      if (contiene && href.length > (activo?.length ?? 0)) activo = href;
    }
  }

  return activo;
}

export function construirMenu(flags: FlagsDelMenu): Bloque[] {
  const {
    solicitudesPendientes,
    puedeVerSolicitudes,
    puedeEscribirDevocionales,
    puedeVerFinanzas,
    puedeVerEventos,
    puedeVerReuniones,
    esPastorDeLaIglesia,
    ministeriosQueLlevo,
    puedeActivarModulos,
  } = flags;

  const bloques: Bloque[] = [
    {
      secciones: [
        { href: '/panel/hoy', etiqueta: 'Inicio', Icono: House, aviso: 0 },
        ...(puedeVerSolicitudes
          ? [
              {
                href: '/panel/solicitudes',
                etiqueta: 'Solicitudes',
                Icono: Inbox,
                aviso: solicitudesPendientes,
              },
            ]
          : []),
      ],
    },
    // Lo que lleva, justo debajo de Inicio y antes que el fichero de la
    // iglesia: para el colíder que no tiene nada más es lo único del menú que
    // es suyo, y para el pastor que además dirige un equipo es el atajo a lo de
    // cada semana. Una entrada por ministerio y no una por módulo: las
    // herramientas de cada equipo son pestañas dentro de su pantalla.
    //
    // Sin ministerios el bloque se queda vacío y el filtro del final lo quita.
    {
      titulo: 'Lo que llevas',
      secciones: ministeriosQueLlevo.map((m) => ({
        href: `/panel/ministerios/${m.id}`,
        etiqueta: m.nombre,
        // Por la paleta y no el hex tal cual: uno guardado que no esté en ella
        // cae al gris, como en la ficha del ministerio, en vez de pintar un
        // color que el sistema de diseño no tiene.
        punto: colorDeMinisterio(m.colorHex).hex,
        aviso: 0,
      })),
    },
    {
      titulo: 'La congregación',
      secciones: [
        {
          href: '/panel/miembros',
          etiqueta: 'Miembros',
          Icono: Users,
          aviso: 0,
        },
        {
          href: '/panel/ministerios',
          etiqueta: 'Ministerios',
          Icono: HandHeart,
          aviso: 0,
        },
        ...(esPastorDeLaIglesia
          ? [
              // `ShieldCheck` y no `Users`: `Users` ya es Miembros, y dos iconos
              // de personas seguidos en el mismo menú se confunden a la primera.
              // Esta sección va de quién puede qué, no de cuánta gente hay.
              {
                href: '/panel/lideres',
                etiqueta: 'Líderes',
                Icono: ShieldCheck,
                aviso: 0,
              },
            ]
          : []),
      ],
    },
    {
      titulo: 'La vida de la iglesia',
      secciones: [
        // Reuniones antes que Eventos, y no por orden alfabético: los cultos son
        // lo que pasa cada semana y los retiros lo que pasa dos veces al año.
        // `CalendarCheck` y no `CalendarDays`, que ya es Eventos: dos
        // calendarios iguales seguidos en el mismo bloque no se distinguen.
        ...(puedeVerReuniones
          ? [
              {
                href: '/panel/reuniones',
                etiqueta: 'Reuniones',
                Icono: CalendarCheck,
                aviso: 0,
              },
            ]
          : []),
        ...(puedeVerEventos
          ? [
              {
                href: '/panel/eventos',
                etiqueta: 'Eventos',
                Icono: CalendarDays,
                aviso: 0,
              },
            ]
          : []),
        ...(puedeEscribirDevocionales
          ? [
              {
                href: '/panel/devocionales',
                etiqueta: 'Devocionales',
                Icono: BookOpen,
                aviso: 0,
              },
            ]
          : []),
        // Comunidad apunta a la CONFIGURACIÓN del muro, no al muro. El muro es
        // de toda la congregación y vive en el área del miembro; lo que se
        // administra desde el panel es qué se puede publicar y quién modera.
        // Antes este enlace llevaba a `/mi/comunidad` y sacaba a la persona del
        // panel de un salto, sin menú y sin forma evidente de volver.
        {
          href: '/panel/comunidad',
          etiqueta: 'Comunidad',
          Icono: MessagesSquare,
          aviso: 0,
        },
      ],
    },
    {
      titulo: 'Administración',
      secciones: [
        ...(puedeVerFinanzas
          ? [
              {
                href: '/panel/finanzas',
                etiqueta: 'Finanzas',
                Icono: Wallet,
                aviso: 0,
              },
            ]
          : []),
        // Compartir lo ve todo el equipo: los enlaces que reparte son públicos,
        // y quien lleva las redes de la iglesia no siempre es quien tiene la
        // contraseña del pastor. Lo único que se escribe ahí —las redes— lo
        // protege su propia action.
        {
          href: '/panel/compartir',
          etiqueta: 'Compartir',
          Icono: Share2,
          aviso: 0,
        },
        // Junto a Ajustes y no al lado de Ministerios: decidir qué usa la
        // iglesia se hace una vez, no cada semana. `Blocks` porque son piezas
        // que se encienden, y no se parece a ningún icono de los de arriba.
        ...(puedeActivarModulos
          ? [
              {
                href: '/panel/modulos',
                etiqueta: 'Módulos',
                Icono: Blocks,
                aviso: 0,
              },
            ]
          : []),
        ...(esPastorDeLaIglesia
          ? [
              {
                href: '/panel/ajustes',
                etiqueta: 'Ajustes',
                Icono: Settings,
                aviso: 0,
              },
            ]
          : []),
      ],
    },
    // Un bloque puede quedarse vacío —«Lo que llevas» en quien no lidera
    // nada—, y vacío sería un encabezado suelto que no lleva a ningún sitio.
  ];

  return bloques.filter((b) => b.secciones.length > 0);
}
