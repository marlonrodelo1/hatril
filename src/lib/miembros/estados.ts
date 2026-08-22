import type { estadoMiembroEnum } from '@/lib/db/schema';

export type EstadoMiembro = (typeof estadoMiembroEnum.enumValues)[number];

/**
 * Cómo se llama y cómo se pinta cada estado.
 *
 * OJO CON `miembro` → «Activo»
 * ----------------------------
 * En la base de datos el valor es `miembro`, que es el término del dominio: en
 * una iglesia, «miembro» significa algo concreto y distinto de «visitante».
 * En pantalla se lee «Activo», que es lo que pide el diseño y lo que un pastor
 * entiende de un vistazo en una columna junto a «Inactivo».
 *
 * La traducción vive AQUÍ y solo aquí. Escrita a mano en cada pantalla, la
 * primera que se despiste enseña «miembro» en minúscula al lado de «Activo» y
 * parecen dos cosas distintas.
 *
 * Los colores salen del sistema de diseño; las clases usan los hex directos
 * porque son tonos de badge que no están mapeados a tokens de shadcn.
 */
export const ESTADOS: Record<
  EstadoMiembro,
  { etiqueta: string; badge: string; avatar: string }
> = {
  miembro: {
    etiqueta: 'Activo',
    badge: 'bg-badge-success-bg text-badge-success-fg',
    avatar: 'bg-muted text-muted-foreground',
  },
  nuevo: {
    etiqueta: 'Nuevo',
    badge: 'bg-badge-accent-bg text-badge-accent-fg',
    // Los recién llegados destacan también en el avatar. Es la gente a la que
    // hay que contactar esta semana, y el diseño los separa del resto.
    avatar: 'bg-badge-accent-bg text-badge-accent-fg',
  },
  visitante: {
    etiqueta: 'Visitante',
    badge: 'bg-badge-warning-bg text-badge-warning-fg',
    avatar: 'bg-muted text-muted-foreground',
  },
  inactivo: {
    etiqueta: 'Inactivo',
    badge: 'bg-muted text-muted-foreground',
    avatar: 'bg-muted text-muted-foreground',
  },
  baja: {
    etiqueta: 'Baja',
    badge: 'bg-muted text-muted-foreground',
    avatar: 'bg-muted text-muted-foreground',
  },
};

/**
 * Los estados que se ofrecen al dar de alta o editar.
 *
 * `baja` no está: no se elige en un desplegable, se llega a ella por la acción
 * de dar de baja, que además pide confirmación. Ponerla aquí convertiría una
 * decisión con consecuencias en un cambio de valor descuidado.
 */
export const ESTADOS_ELEGIBLES: EstadoMiembro[] = [
  'visitante',
  'nuevo',
  'miembro',
  'inactivo',
];
