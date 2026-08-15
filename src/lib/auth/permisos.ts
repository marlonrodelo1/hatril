/**
 * Qué puede hacer cada persona dentro de una iglesia.
 *
 * Adaptado de `gonper/src/lib/auth/permisos.ts`, que lleva meses en producción.
 * La estructura se conserva entera porque resuelve bien el problema; lo que
 * cambia son los roles, las capacidades y —esto sí es nuevo— el segundo eje de
 * abajo.
 *
 * DOS PREDICADOS, NO UNO
 * ----------------------
 *   - `esPastor(ctx)`  → gobierno de la iglesia: ajustes, equipo, facturación,
 *     bajas. NO es delegable: no hay permiso que se lo dé a nadie más.
 *   - `puede(ctx, p)`  → las cinco capacidades que el pastor SÍ reparte.
 *
 * DÓNDE SE GUARDAN
 * ----------------
 * En `iglesia_usuarios.permisos`, un jsonb con SOLO LAS EXCEPCIONES al valor
 * por defecto del rol. Se eligió así porque añadir un permiso nuevo no cuesta
 * migración, `{}` ya significa «los defectos», y sacar a alguien de la norma es
 * un UPDATE de una fila.
 *
 * Y sobre todo: **`pastor` IGNORA el jsonb por completo**. Un UPDATE mal hecho
 * no puede dejar al pastor fuera de su propia iglesia.
 *
 * LOS DOS EJES NO SE CRUZAN
 * -------------------------
 * En Gonper la regla era «el dinero no se delega»: ver toda la agenda no abría
 * la caja. Aquí el equivalente es más importante todavía, porque hablamos de
 * datos del art. 9 del RGPD:
 *
 *   `ver_todos_los_miembros` amplía las FILAS que se ven.
 *   `ver_datos_sensibles`    amplía las COLUMNAS que se ven.
 *
 * Son ejes independientes a propósito. Un líder de alabanza puede necesitar la
 * lista entera de la congregación para invitar gente a su ministerio, y eso no
 * tiene por qué darle la dirección, la fecha de nacimiento ni las notas de cada
 * persona. Si un solo permiso hiciera las dos cosas, dar el primero regalaría
 * el segundo por la puerta de atrás.
 */

/** Rol dentro de una iglesia. Coincide con `rol_iglesia_enum` en Postgres. */
export type RolIglesia =
  | 'pastor'
  | 'lider'
  | 'tesorero'
  | 'secretaria'
  | 'miembro';

export const PERMISOS = [
  /** Ver la congregación entera, no solo los miembros de sus ministerios. */
  'ver_todos_los_miembros',
  /** Dar de alta personas, editar sus fichas y darlas de baja. */
  'editar_miembros',
  /** Crear ministerios, editarlos y asignarles gente. */
  'gestionar_ministerios',
  /** Aceptar o rechazar a quien pide entrar desde el directorio. */
  'aprobar_solicitudes',
  /** Ver fecha de nacimiento, dirección, estado civil y notas. */
  'ver_datos_sensibles',
] as const;

export type Permiso = (typeof PERMISOS)[number];
export type MapaPermisos = Record<Permiso, boolean>;

/**
 * Cómo se le cuenta cada permiso al pastor en la pantalla de Equipo.
 *
 * Vive aquí, pegado al catálogo, para que añadir un permiso obligue a escribir
 * su texto en el mismo sitio: `Record<Permiso, …>` no compila si falta uno.
 *
 * Redactado desde lo que el pastor está decidiendo de verdad —quién ve la
 * dirección de las familias, quién puede dar de baja a alguien— y no desde cómo
 * se llama la clave en base de datos.
 */
export const ETIQUETAS_PERMISOS: Record<
  Permiso,
  { titulo: string; descripcion: string }
> = {
  ver_todos_los_miembros: {
    titulo: 'Ver la congregación entera',
    descripcion:
      'Ve a todas las personas de la iglesia, no solo a las de sus ministerios. No incluye sus datos personales: eso es el permiso de abajo.',
  },
  editar_miembros: {
    titulo: 'Dar de alta y editar personas',
    descripcion:
      'Crea fichas nuevas, corrige las existentes y da de baja. La baja no borra el histórico de ministerios.',
  },
  gestionar_ministerios: {
    titulo: 'Gestionar los ministerios',
    descripcion:
      'Crea y edita ministerios, nombra líderes y mueve gente de uno a otro.',
  },
  aprobar_solicitudes: {
    titulo: 'Aceptar a quien pide entrar',
    descripcion:
      'Revisa las solicitudes que llegan desde el directorio. Quien apruebe pasa a ver el contenido interno de la iglesia.',
  },
  ver_datos_sensibles: {
    // Se nombra el dato concreto porque «datos sensibles» suena a jerga legal y
    // un pastor que solo lea el título lo da por «datos de contacto» y acaba
    // repartiendo las direcciones de las familias de su congregación.
    titulo: 'Ver dirección, fecha de nacimiento y notas',
    descripcion:
      'Datos especialmente protegidos por la ley. Dáselo solo a quien lo necesite para su trabajo: cada consulta queda registrada con su nombre.',
  },
};

/**
 * Lo que puede alguien recién aceptado: nada más que lo suyo. Se empieza
 * cerrado y el pastor abre lo que quiera, no al revés.
 */
const NINGUNO: MapaPermisos = {
  ver_todos_los_miembros: false,
  editar_miembros: false,
  gestionar_ministerios: false,
  aprobar_solicitudes: false,
  ver_datos_sensibles: false,
};

const TODOS: MapaPermisos = {
  ver_todos_los_miembros: true,
  editar_miembros: true,
  gestionar_ministerios: true,
  aprobar_solicitudes: true,
  ver_datos_sensibles: true,
};

/**
 * Defectos por rol.
 *
 * `secretaria` nace con casi todo porque es literalmente quien lleva el fichero
 * de la iglesia: si hubiera que concederle cada permiso a mano, el pastor
 * pasaría por la pantalla de equipo antes de poder delegar nada, y acabaría
 * dándole el rol de pastor «para que funcione».
 *
 * `lider` nace cerrado: ve su ministerio por ámbito (ver `ambitoMiembros`), que
 * no es un permiso sino la consecuencia de a qué ministerios pertenece.
 *
 * `tesorero` no toca personas. En la v1 no hay finanzas todavía, así que el rol
 * existe sin capacidades: reservarlo ahora evita tener que migrar filas cuando
 * llegue el módulo.
 */
const DEFECTOS_POR_ROL: Record<RolIglesia, MapaPermisos> = {
  pastor: TODOS,
  secretaria: {
    ...NINGUNO,
    ver_todos_los_miembros: true,
    editar_miembros: true,
    aprobar_solicitudes: true,
    ver_datos_sensibles: true,
  },
  lider: NINGUNO,
  tesorero: NINGUNO,
  miembro: NINGUNO,
};

/** ¿Gobierna la iglesia? Ajustes, equipo, facturación y bajas. */
export function esPastor(ctx: { rol: RolIglesia }): boolean {
  return ctx.rol === 'pastor';
}

/**
 * Mapa de permisos efectivo.
 *
 * Para `pastor` devuelve todo concedido SIN mirar lo guardado — ver la cabecera.
 * Para el resto, los defectos de su rol con las excepciones encima. Las claves
 * que no estén en el catálogo se ignoran, así que un permiso mal escrito en
 * base de datos es inerte y no concede nada por accidente.
 */
export function resolverPermisos(
  rol: RolIglesia,
  guardados: unknown,
): MapaPermisos {
  if (esPastor({ rol })) return { ...TODOS };

  const mapa = { ...(DEFECTOS_POR_ROL[rol] ?? NINGUNO) };

  if (guardados && typeof guardados === 'object' && !Array.isArray(guardados)) {
    const obj = guardados as Record<string, unknown>;
    for (const p of PERMISOS) {
      if (typeof obj[p] === 'boolean') mapa[p] = obj[p];
    }
  }

  return mapa;
}

/**
 * El inverso de `resolverPermisos`: de lo que el pastor dejó marcado en el
 * formulario al jsonb mínimo que se guarda.
 *
 * Vive pegado a su inverso porque las dos mitades tienen que estar de acuerdo
 * sobre qué es «el defecto»; separadas, cambiar un defecto arreglaría la
 * lectura y dejaría la escritura guardando el valor viejo.
 *
 * Recibe un predicado y no un mapa ya montado para que quien llama no tenga que
 * recorrer el catálogo por su cuenta — recorrerlo es justo lo que impide que
 * una casilla desmarcada, que no viaja en el FormData, se lea como «no la
 * toques».
 */
export function excepcionesSobreDefecto(
  rol: RolIglesia,
  estaMarcado: (permiso: Permiso) => boolean,
): Partial<Record<Permiso, boolean>> {
  const defectos = DEFECTOS_POR_ROL[rol] ?? NINGUNO;
  const excepciones: Partial<Record<Permiso, boolean>> = {};

  for (const permiso of PERMISOS) {
    const valor = estaMarcado(permiso);
    if (valor !== defectos[permiso]) excepciones[permiso] = valor;
  }

  return excepciones;
}

/**
 * Lo mínimo que necesita cualquier comprobación de permisos.
 *
 * Es estructural a propósito: lo cumple `UserContext` sin herencia ni
 * adaptadores, y cualquier contexto futuro (una API con Bearer para la app
 * móvil) lo cumplirá igual escribiendo los tres campos.
 */
export interface ContextoPermisos {
  rol: RolIglesia;
  permisos: MapaPermisos;
  /** Ficha de miembro de esta persona, si la tiene. */
  miembroId: string | null;
  /** Ministerios en los que sirve. Define su ámbito cuando no ve la iglesia entera. */
  ministerioIds: string[];
}

export function puede(ctx: ContextoPermisos, permiso: Permiso): boolean {
  return ctx.permisos[permiso] === true;
}

/**
 * A QUIÉN puede ver esta persona.
 *
 * `ninguno` es el caso raro pero real: una cuenta activa cuya ficha de miembro
 * se borró, o un líder al que sacaron de todos sus ministerios. Se devuelve
 * explícitamente en vez de caer a `iglesia`, porque fallar abierto aquí
 * significaría enseñar la congregación entera a alguien que ya no debería
 * verla.
 */
export type AmbitoMiembros =
  | { tipo: 'iglesia' }
  | { tipo: 'ministerios'; ministerioIds: string[] }
  | { tipo: 'propio'; miembroId: string }
  | { tipo: 'ninguno' };

export function ambitoMiembros(ctx: ContextoPermisos): AmbitoMiembros {
  if (esPastor(ctx)) return { tipo: 'iglesia' };
  if (puede(ctx, 'ver_todos_los_miembros')) return { tipo: 'iglesia' };
  if (ctx.ministerioIds.length > 0) {
    return { tipo: 'ministerios', ministerioIds: ctx.ministerioIds };
  }
  if (ctx.miembroId) return { tipo: 'propio', miembroId: ctx.miembroId };
  return { tipo: 'ninguno' };
}

/**
 * QUÉ CAMPOS de una ficha puede ver.
 *
 * Deliberadamente NO mira el ámbito: son los dos ejes de la cabecera. Ampliar a
 * cuánta gente ve alguien nunca amplía cuántos datos ve de cada persona.
 */
export function puedeVerDatosSensibles(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'ver_datos_sensibles');
}

/**
 * ¿Puede tocar ESTA ficha?
 *
 * Sin ficha propia no se toca nada, ni con `editar_miembros` puesto: es la
 * misma cuenta a la que `ambitoMiembros` devuelve 'ninguno'. La comprobación va
 * ANTES del permiso y no después, porque colocada al revés alguien que ya no
 * puede ni ver la congregación podría seguir editando fichas sabiendo solo el
 * id — y los ids viajan en las URL del panel.
 */
export function puedeEditarMiembro(
  ctx: ContextoPermisos,
  miembroId: string,
): boolean {
  if (esPastor(ctx)) return true;
  if (!ctx.miembroId) return false;
  // Cada cual puede corregir su propia ficha siempre.
  if (ctx.miembroId === miembroId) return true;
  return puede(ctx, 'editar_miembros');
}
