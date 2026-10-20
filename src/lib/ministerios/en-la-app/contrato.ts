import type { ContextoPermisos } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';
import type { ModuloId } from '@/lib/ministerios/modulos';

/**
 * Lo que cada módulo declara para salir en la app del líder (`/mi/equipo`).
 *
 * POR QUÉ UN CONTRATO Y NO UN `if` POR TIPO
 * -----------------------------------------
 * La portada de un ministerio se monta a partir de `modulosActivos()`: por cada
 * herramienta encendida, la tarjeta que esa herramienta sabe pintar. Si la
 * portada supiera qué es un turno o un ensayo, cada módulo nuevo —reparto,
 * emisora, nuevos de consolidación— tendría que entrar a tocarla, y los módulos
 * se están construyendo a la vez en ramas distintas. Así cada uno trae su
 * adaptador en su propia carpeta y lo apunta en `registro.ts`, que es una línea.
 *
 * Es la misma idea que `modulos.ts` un nivel más arriba: se programan piezas, y
 * la pantalla las junta sin conocerlas.
 *
 * SIN `server-only`, PORQUE SOLO SON TIPOS
 * ----------------------------------------
 * Los adaptadores sí tocan la base y llevan su `server-only`; esto lo puede
 * importar cualquiera sin arrastrar nada.
 */

/** Una cosa que pide que alguien haga algo. */
export type Pendiente = {
  /** Qué pasa, en una línea: «Domingo 26 · Culto dominical». */
  texto: string;
  /** El porqué, si hace falta: «Faltan Bajo y Teclado · Marta no puede». */
  detalle?: string;
  /** La pantalla de la app donde se arregla. */
  href: string;
  /**
   * Pinta el icono de aviso. Para lo que se rompe si nadie lo mira —un puesto
   * sin cubrir, un «no puedo»—, no para lo que solo está sin hacer.
   */
  urgente?: boolean;
};

/** Lo que enseña la tarjeta de un módulo en la portada. */
export type ResumenDeModulo = {
  /**
   * Lo que pide atención, ya ordenado y ya recortado: la portada es para mirar
   * de un vistazo, y una tarjeta con doce líneas empuja a las demás fuera de la
   * pantalla. Vacío es «todo en orden».
   */
  pendientes: Pendiente[];
  /** Cuántos más había y no caben. Sale como «y 4 más» junto al enlace. */
  restantes?: number;
  /**
   * Lo siguiente que viene aunque esté en orden: «Jueves 30 · Ensayo · 19:00».
   * Sin esto, una tarjeta sin pendientes se queda en blanco y no se sabe si es
   * que todo va bien o que no hay nada apuntado.
   */
  proximo?: { texto: string; detalle?: string; href: string } | null;
  /** La frase cuando no hay ni pendientes ni próximo. */
  vacio: string;
};

export type ModuloEnLaApp = {
  id: ModuloId;
  /** El texto del enlace a su pantalla: «Ver los turnos». */
  abrir: string;
  /**
   * Dónde está su pantalla.
   *
   *   - `'app'`   → `/mi/equipo/[id]/<id>`, la misma ruta que en el panel con
   *                 otro prefijo. Es lo que deja que `enLaApp()` reutilice las
   *                 actions del panel traduciendo su destino.
   *   - `'panel'` → `/panel/ministerios/[id]/<id>`. Para el módulo que ya tiene
   *                 resumen en la app y todavía no su pantalla: el líder entra
   *                 al panel desde la base común, así que el enlace funciona.
   */
  pantalla: 'app' | 'panel';
  /**
   * Una puerta de más, aparte de llevar el ministerio y tener el módulo
   * encendido. El seguimiento pide `ver_seguimiento`. Tiene que decir lo mismo
   * que el `layout.tsx` del módulo en el panel, o la tarjeta saldría a quien
   * luego rebota.
   */
  visiblePara?: (ctx: ContextoPermisos) => boolean;
  /**
   * La tarjeta de la portada. Recibe el ministerio ya cargado —con su equipo y
   * sus módulos— para que ningún adaptador lo vuelva a pedir, y `hoy` en la
   * zona de la iglesia, que es la fecha contra la que se decide qué está por
   * venir.
   */
  resumen: (
    ctx: UserContext,
    ministerio: MinisterioDetalle,
    hoy: string,
  ) => Promise<ResumenDeModulo>;
};
