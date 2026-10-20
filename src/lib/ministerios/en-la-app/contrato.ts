import type { LucideIcon } from 'lucide-react';

import type { ContextoPermisos } from '@/lib/auth/permisos';
import type { UserContext } from '@/lib/auth/user-context';
import type { MinisterioDetalle } from '@/lib/ministerios/consultas';
import type { ModuloId } from '@/lib/ministerios/modulos';

/**
 * Lo que cada módulo declara para salir en la zona de equipos de la app
 * (`/mi/equipo`), para quien lo lleva y para quien participa.
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
  /**
   * Cifras para mirar, en una fila: «Hay en el fondo · $ 1.250.000». Para la
   * herramienta cuya pregunta no es «¿falta algo?» sino «¿cuánto?», como el
   * fondo. Van encima de lo demás, y con ellas no se pinta `vacio`.
   */
  cifras?: { rotulo: string; valor: string }[];
  /**
   * El enlace del pie de la tarjeta, si no es el de siempre.
   *
   * Lo usa la vista del participante: su pie no lleva a la herramienta del
   * líder —esa pantalla le daría 404— sino a donde lo suyo ya vive, que casi
   * siempre es `/mi/agenda`. Sin él, la tarjeta del participante va sin pie.
   */
  enlace?: { texto: string; href: string } | null;
};

/**
 * Las dos formas de mirar un ministerio desde la app.
 *
 * LA APP ES UNA, Y LA USAN LOS DOS
 * --------------------------------
 * Quien LLEVA el ministerio ve lo que pide atención y entra a arreglarlo. Quien
 * PARTICIPA sin liderar ve lo suyo: sus turnos, el próximo ensayo, la lista del
 * domingo. Nunca las respuestas de los demás —que Fulano dijo que no puede es
 * una conversación entre él y quien lleva el equipo— ni nada de una
 * herramienta que solo es del líder, como el seguimiento.
 */
export type ModoEnElEquipo = 'lider' | 'participante';

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
   * Una puerta de más para el modo líder, aparte de llevar el ministerio
   * (`puedeGestionarMinisterio`) y tener el módulo encendido. Tiene que decir
   * lo mismo que la guarda del módulo en el panel, o la tarjeta saldría a quien
   * luego rebota.
   *
   * Recibe el ministerio porque hay puertas que dependen de cuál es: el
   * reparto pide `puedeGestionarDesdeDentro` —pastor o quien lidera ESE
   * equipo—, porque su RLS (`0042`) va por equipo y quien organiza ministerios
   * desde secretaría no ve nada de él. El seguimiento, en cambio, pide un
   * permiso (`ver_seguimiento`) que no depende del ministerio.
   *
   * La aplican las tres puertas a la vez —la tarjeta de la portada
   * (`modulosDeLaPortada`), las pantallas (`requireMinisterioEnLaApp`) y las
   * actions (`enLaApp`)—, así que un módulo nuevo que la declare queda cerrado
   * en todas sin escribir su guarda.
   */
  visiblePara?: (ctx: ContextoPermisos, ministerioId: string) => boolean;
  /**
   * La tarjeta de la portada de quien LLEVA el ministerio. Recibe el ministerio
   * ya cargado —con su equipo y sus módulos— para que ningún adaptador lo vuelva
   * a pedir, y `hoy` en la zona de la iglesia, que es la fecha contra la que se
   * decide qué está por venir.
   */
  resumen: (
    ctx: UserContext,
    ministerio: MinisterioDetalle,
    hoy: string,
  ) => Promise<ResumenDeModulo>;
  /**
   * La tarjeta de quien PARTICIPA sin liderar. Opcional a propósito: un módulo
   * que no la declara no le enseña nada al participante —el seguimiento, por
   * ejemplo, es solo del líder—. Lo que pinte aquí tiene que poder abrirlo
   * cualquiera del equipo: sus enlaces van a pantallas del miembro (`/mi/...`),
   * no a las herramientas de `/mi/equipo/[id]/...`, que le darían 404.
   */
  participante?: (
    ctx: UserContext,
    ministerio: MinisterioDetalle,
    hoy: string,
  ) => Promise<ResumenDeModulo>;
};

/** Lo que una tarjeta de la portada necesita para pintarse: nombre e icono. */
export type PiezaDeLaPortada = {
  id: string;
  nombre: string;
  Icono: LucideIcon;
};

/**
 * Una herramienta que sale en la portada de un ministerio SIN ser uno de sus
 * módulos (`ministerios.modulos`).
 *
 * Hoy, el fondo: no lo enciende quien gobierna los ministerios con una casilla,
 * lo decide el pastor vinculando un fondo de la caja desde Finanzas. Por eso no
 * pasa por `modulosActivos()` y trae su propia `aplica`, que mira ese dato y la
 * puerta a la vez —y que tiene que decir lo mismo que la guarda de su pantalla—.
 *
 * El resto es el contrato de siempre: `resumen` para quien lleva el equipo y
 * `participante` opcional. Su pantalla de la app, si `pantalla` es `'app'`,
 * va en `/mi/equipo/[id]/<id>` y pone ella misma su guarda: las de
 * `guarda.ts` son de módulos.
 */
export type HerramientaDerivada = Omit<ModuloEnLaApp, 'id' | 'visiblePara'> &
  PiezaDeLaPortada & {
    aplica: (ctx: ContextoPermisos, ministerio: MinisterioDetalle) => boolean;
  };
