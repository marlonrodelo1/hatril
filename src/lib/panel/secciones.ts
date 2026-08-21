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
  type LucideIcon,
} from 'lucide-react';

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

export type Seccion = {
  href: string;
  etiqueta: string;
  Icono: LucideIcon;
  aviso: number;
};

export type Bloque = {
  /** Sin encabezado el bloque no se puede plegar: es el de arriba del todo. */
  titulo?: string;
  secciones: Seccion[];
};

export function construirMenu(flags: FlagsDelMenu): Bloque[] {
  const {
    solicitudesPendientes,
    puedeVerSolicitudes,
    puedeEscribirDevocionales,
    puedeVerFinanzas,
    puedeVerEventos,
    puedeVerReuniones,
    esPastorDeLaIglesia,
  } = flags;

  return [
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
    // Un bloque puede quedarse vacío: un líder de alabanza no ve ni finanzas ni
    // ajustes, y solo le queda Compartir.
  ].filter((b) => b.secciones.length > 0);
}
