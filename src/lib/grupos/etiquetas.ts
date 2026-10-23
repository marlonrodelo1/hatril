/**
 * Cómo se llaman los grupos de cada tipo de ministerio.
 *
 * La pieza es una sola (`schema/grupos.ts`) y no sabe qué es una célula: en una
 * red son «células», en la escuela dominical serán «clases», y en cualquier
 * otro ministerio que encienda el módulo, «grupos». Las pantallas sacan la
 * palabra de aquí y no la escriben, para que el día que la escuela encienda la
 * pieza no salga «Tu célula» encima de la clase de un niño.
 *
 * Las frases que piden género («todas las células», «ningún grupo») vienen ya
 * hechas; el resto se escribe para no necesitarlo («Tu célula», «cada grupo»).
 *
 * Sin `server-only`: lo usan pantallas y componentes de cliente.
 */

export type EtiquetasDeGrupos = {
  /** «célula» */
  uno: string;
  /** «células» */
  varios: string;
  /** «Nueva célula» */
  nuevo: string;
  /** «todas las células» */
  todos: string;
  /** «ninguna célula» */
  ninguno: string;
  /** «la red»: de qué cuelgan. */
  laRed: string;
  /** «Esta red» */
  estaRed: string;
};

const POR_TIPO: Record<string, EtiquetasDeGrupos> = {
  celulas: {
    uno: 'célula',
    varios: 'células',
    nuevo: 'Nueva célula',
    todos: 'todas las células',
    ninguno: 'ninguna célula',
    laRed: 'la red',
    estaRed: 'Esta red',
  },
};

const POR_DEFECTO: EtiquetasDeGrupos = {
  uno: 'grupo',
  varios: 'grupos',
  nuevo: 'Nuevo grupo',
  todos: 'todos los grupos',
  ninguno: 'ningún grupo',
  laRed: 'el ministerio',
  estaRed: 'Este ministerio',
};

export function etiquetasDeGrupos(tipo: string | null | undefined): EtiquetasDeGrupos {
  return POR_TIPO[tipo ?? ''] ?? POR_DEFECTO;
}

/** «célula» → «Célula». */
export function mayuscula(texto: string): string {
  return texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
}
