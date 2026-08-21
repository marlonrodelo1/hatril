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
 *   - `puede(ctx, p)`  → las capacidades que el pastor SÍ reparte.
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
 *
 * EL ÁMBITO NO VIVE EN EL PERMISO
 * -------------------------------
 * `gestionar_su_ministerio` dice «esta persona lleva lo suyo», y nada más. QUÉ
 * es lo suyo sale del dato —de qué ministerios lidera—, no del jsonb. Separados
 * así, dárselo por error a un tesorero no le abre absolutamente nada, porque no
 * lidera ninguno.
 */

/**
 * Rol dentro de una iglesia. Coincide con `rol_iglesia_enum` en Postgres.
 *
 * Array y no unión de literales suelta: hace falta poder recorrerlo para pintar
 * el desplegable de la pantalla de Equipo y para el `z.enum` de su action, y así
 * el tipo y la lista no pueden separarse. Mismo patrón que `PERMISOS`.
 */
export const ROLES_IGLESIA = [
  'pastor',
  'lider',
  'tesorero',
  'secretaria',
  'miembro',
] as const;

export type RolIglesia = (typeof ROLES_IGLESIA)[number];

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
  /** Llevar los ministerios que lidera. Acotado por el dato, no por el permiso. */
  'gestionar_su_ministerio',
  /** Escribir el devocional que sale en la web de la iglesia. */
  'escribir_devocionales',
  /**
   * Llevar la caja: apuntar lo que entra y lo que sale, y ver las cuentas.
   *
   * UNO Y NO CUATRO
   * ---------------
   * La tentación era partirlo en ver / registrar / aprobar / exportar. En una
   * congregación de 120 personas esas cuatro son la misma persona, y cada
   * casilla de más en `/panel/lideres` es una decisión que el pastor toma sin
   * información y acaba resolviendo dándoselo todo a todo el mundo — que es
   * justo lo que este modelo de permisos existe para evitar.
   *
   * La segregación de funciones de verdad (que quien cuenta el dinero no sea
   * quien lo verifica) no se hace con permisos: necesita que el verificador sea
   * el usuario de la sesión, y eso llega con el arqueo. Un permiso suelto que
   * la simule sería peor que no tenerla, porque parecería un control.
   */
  'gestionar_finanzas',
  /**
   * Crear eventos, publicarlos y llevar la lista de inscritos.
   *
   * No cabe en `gestionar_ministerios` —un retiro no es un ministerio— y
   * `esPastor()` se queda corto: el campamento de jóvenes lo organiza el líder
   * de jóvenes, y si hiciera falta ser pastor para crearlo, el pastor acabaría
   * creando los eventos de todos.
   *
   * Lleva consigo ver nombre y correo de gente que NO es de la congregación, así
   * que es un permiso con peso: quien lo tiene ve la lista de asistentes a un
   * acto religioso.
   */
  'gestionar_eventos',
  /**
   * Pasar lista: crear las reuniones de la iglesia y apuntar quién vino.
   *
   * PERMISO PROPIO, Y NO UN HUECO DE `editar_miembros`
   * --------------------------------------------------
   * Quien pasa lista ve, semana a semana, quién estuvo en un culto y quién no.
   * Eso es dato del art. 9 en su forma más pura —no algo de lo que se infiera la
   * religión, sino la práctica religiosa nominal y fechada—, y es una lista
   * distinta de la que ve quien corrige un teléfono. Colgarlo de
   * `editar_miembros` le daría el histórico de asistencia entero a quien solo
   * tenía que arreglar fichas.
   *
   * Lo lleva `secretaria` por defecto por la misma razón que `gestionar_eventos`:
   * es quien tiene el fichero y la agenda de la iglesia delante, y sin esto el
   * pastor acabaría pasando lista él todos los domingos.
   *
   * NO abre el seguimiento pastoral, que es el otro eje y llega con su propio
   * permiso: saber quién faltó no es lo mismo que saber por qué.
   */
  'registrar_asistencia',
  /**
   * Ver por qué la gente ha dejado de venir, y apuntar lo que se habla con ella.
   *
   * EL PERMISO MÁS PESADO DEL CATÁLOGO, Y POR ESO ESTÁ SOLO
   * -------------------------------------------------------
   * `registrar_asistencia` abre QUIÉN vino. Esto abre POR QUÉ dejó de venir:
   * quién está molesto con la iglesia, quién se mudó, a quién no se puede
   * localizar. Con nombre y apellidos, y de la congregación entera.
   *
   * No es defecto de NINGÚN rol, ni siquiera de secretaría. El pastor lo reparte
   * a mano, persona a persona, y esa fricción es el punto: si viniera puesto de
   * fábrica con un rol, se repartiría sin que nadie decidiera repartirlo.
   *
   * Y no basta con tenerlo. El layout de la sección exige ADEMÁS ser responsable
   * o colíder del ministerio que hace el seguimiento, así que dárselo por error a
   * un tesorero no le abre absolutamente nada — el mismo diseño de dos llaves que
   * `gestionar_su_ministerio`, donde el permiso declara la política y el dato
   * pone el ámbito.
   */
  'ver_seguimiento',
  /**
   * Borrar publicaciones y comentarios de otros en el muro de la comunidad.
   *
   * NUNCA ES DEFECTO DE NINGÚN ROL, Y ESO ES DELIBERADO
   * ---------------------------------------------------
   * El pastor modera por ser pastor —lo resuelve `es_pastor()` en las policies,
   * sin mirar el jsonb—. Para cualquier otra persona este permiso solo existe
   * si alguien lo marcó a mano, así que en `iglesia_usuarios.permisos` aparece
   * siempre como excepción explícita `{"moderar_comunidad": true}`.
   *
   * Eso no es un detalle de estilo: la policy de la migración `0027` lee ese
   * jsonb tal cual, buscando el `true` literal. Si este permiso llegara a ser
   * defecto de algún rol, la base de datos no se enteraría —los defectos por
   * rol viven solo en este fichero— y la interfaz enseñaría un botón de borrar
   * que la RLS rechazaría. Sale barato mantenerlo así: es el único permiso que
   * la base de datos consulta, precisamente porque es el único que no depende
   * de la tabla de defectos.
   */
  'moderar_comunidad',
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
  gestionar_su_ministerio: {
    titulo: 'Llevar sus propios ministerios',
    descripcion:
      'Quien sea responsable o colíder de un ministerio puede editarlo y mover a su gente, solo dentro de ese ministerio. No le deja crear ministerios nuevos ni tocar los de los demás.',
  },
  escribir_devocionales: {
    titulo: 'Escribir el devocional',
    descripcion:
      'Redacta y publica el devocional del día en la web de la iglesia. Solo puede tocar los días que le hayas asignado.',
  },
  gestionar_finanzas: {
    // Se dice explícitamente que Hatril NO guarda quién dio cuánto, porque es
    // la primera pregunta que se hace un pastor al leer «finanzas» y la
    // respuesta cambia a quién se lo da.
    titulo: 'Llevar las cuentas',
    descripcion:
      'Apunta la ofrenda de cada culto, los diezmos y los gastos, y ve cuánto entró y salió en cada mes. Son totales: Hatril no guarda quién dio cuánto.',
  },
  ver_seguimiento: {
    // Se nombra lo que de verdad se está abriendo. «Seguimiento pastoral» suena
    // a tarea, y lo que el pastor decide al marcar esta casilla es enseñarle a
    // alguien por qué cada persona de su congregación dejó de venir.
    titulo: 'Ver por qué la gente deja de venir',
    descripcion:
      'Ve quién lleva tiempo sin aparecer, con su teléfono, y lo que se ha hablado con cada persona. Es lo más delicado que guarda Hatril: dáselo solo a quien de verdad acompaña gente, y hace falta además que lleve el ministerio que hace el seguimiento.',
  },
  registrar_asistencia: {
    // Se nombra el histórico y no solo el acto de marcar casillas: lo que el
    // pastor concede aquí no es «pasar lista un domingo», es ver quién viene y
    // quién falta, semana a semana, de toda la congregación.
    titulo: 'Pasar lista en las reuniones',
    descripcion:
      'Apunta las reuniones de la iglesia y quién vino a cada una. Con ello ve el histórico de asistencia de toda la congregación, que es dato especialmente protegido por la ley.',
  },
  gestionar_eventos: {
    // Se avisa de lo que de verdad decide el pastor al marcar esta casilla: no
    // es «crear carteles», es ver la lista de quién viene, con gente de fuera
    // incluida.
    titulo: 'Organizar eventos',
    descripcion:
      'Crea retiros, congresos y conciertos, los publica en la web de la iglesia y ve quién se ha apuntado, incluidas personas que no son de la congregación.',
  },
  moderar_comunidad: {
    titulo: 'Moderar la comunidad',
    descripcion:
      'Borra publicaciones y comentarios de cualquiera en el muro de la congregación. No puede editarlos: cambiarle el texto a alguien y dejar su nombre debajo es suplantarle.',
  },
};

/**
 * Cómo se le presenta cada rol al pastor. Junto al catálogo por lo mismo que las
 * etiquetas de permisos: añadir un rol obliga a explicarlo aquí.
 *
 * Antes vivía una copia de esto en el sidebar, solo con el título. Al necesitar
 * el desplegable de Equipo la descripción, se unificó aquí para no tener dos
 * listas de roles que puedan discrepar.
 */
export const ETIQUETAS_ROLES: Record<
  RolIglesia,
  { titulo: string; descripcion: string }
> = {
  pastor: {
    titulo: 'Pastor',
    descripcion:
      'Gobierna la iglesia entera: ajustes, equipo, suscripción y bajas. No se le puede recortar nada.',
  },
  lider: {
    titulo: 'Líder',
    descripcion:
      'Lleva los ministerios de los que es responsable. Del resto de la congregación no ve nada salvo que se lo des.',
  },
  tesorero: {
    titulo: 'Tesorero',
    descripcion:
      'Lleva la caja: apunta lo que entra y lo que sale y ve las cuentas de la iglesia. De las personas no ve nada más que cualquier otro miembro.',
  },
  secretaria: {
    titulo: 'Secretaría',
    descripcion:
      'Lleva el fichero: ve la congregación entera con sus datos, edita fichas y acepta solicitudes.',
  },
  miembro: {
    titulo: 'Miembro',
    descripcion:
      'Solo lo suyo. Es lo que recibe quien entra desde el directorio público.',
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
  gestionar_su_ministerio: false,
  escribir_devocionales: false,
  gestionar_finanzas: false,
  gestionar_eventos: false,
  registrar_asistencia: false,
  ver_seguimiento: false,
  moderar_comunidad: false,
};

const TODOS: MapaPermisos = {
  ver_todos_los_miembros: true,
  editar_miembros: true,
  gestionar_ministerios: true,
  aprobar_solicitudes: true,
  ver_datos_sensibles: true,
  gestionar_su_ministerio: true,
  escribir_devocionales: true,
  gestionar_finanzas: true,
  gestionar_eventos: true,
  registrar_asistencia: true,
  ver_seguimiento: true,
  moderar_comunidad: true,
};

/**
 * Defectos por rol.
 *
 * `secretaria` nace con casi todo porque es literalmente quien lleva el fichero
 * de la iglesia: si hubiera que concederle cada permiso a mano, el pastor
 * pasaría por la pantalla de equipo antes de poder delegar nada, y acabaría
 * dándole el rol de pastor «para que funcione».
 *
 * `lider` nace con `gestionar_su_ministerio` y con nada más, porque es justo lo
 * que el rol significa. VER su ministerio ya lo tenía por ámbito (ver
 * `ambitoMiembros`), que no es un permiso sino la consecuencia de a qué
 * ministerios pertenece; esto es la otra mitad, qué puede ESCRIBIR ahí dentro.
 *
 * `tesorero` no toca personas: lleva la caja y nada más. El rol existía vacío
 * desde la `0000` esperando justo esto, así que estrenarlo no cuesta migrar ni
 * una fila — el jsonb guarda excepciones sobre el defecto, y quien ya era
 * tesorero con `{}` gana el permiso solo.
 *
 * NI SECRETARÍA NI LÍDER lo reciben por defecto, y el líder es el caso que
 * conviene razonar: no es que no pinte nada en la caja, es que un agregado NO
 * es inocuo por ser agregado. En una congregación de treinta personas, el total
 * de un culto más saber quién faltó ese domingo se acerca bastante al dato
 * nominal. El agregado protege a escala, y esto se vende a iglesias pequeñas.
 */
const DEFECTOS_POR_ROL: Record<RolIglesia, MapaPermisos> = {
  pastor: TODOS,
  secretaria: {
    ...NINGUNO,
    ver_todos_los_miembros: true,
    editar_miembros: true,
    aprobar_solicitudes: true,
    ver_datos_sensibles: true,
    // La secretaría lleva ya el fichero y la agenda de la iglesia: el
    // calendario es el mismo trabajo, y sin esto el pastor tendría que crear
    // cada evento él.
    gestionar_eventos: true,
    // Y por lo mismo, la lista del domingo. Es la única persona de la tabla que
    // ya ve la congregación entera con `ver_todos_los_miembros`, así que esto no
    // le amplía a cuánta gente alcanza: le deja apuntar lo que ya tiene delante.
    registrar_asistencia: true,
  },
  lider: { ...NINGUNO, gestionar_su_ministerio: true },
  tesorero: { ...NINGUNO, gestionar_finanzas: true },
  miembro: NINGUNO,
};

/** ¿Gobierna la iglesia? Ajustes, equipo, facturación y bajas. */
export function esPastor(ctx: { rol: RolIglesia }): boolean {
  return ctx.rol === 'pastor';
}

/**
 * ¿Tiene algo que hacer en el panel?
 *
 * El panel es de quien lleva la iglesia. Un miembro raso tiene su área en `/mi`,
 * y meterlo en `/panel` le enseña un menú de ocho secciones donde no puede
 * pulsar casi nada — con Miembros y Ministerios en la primera línea, que son el
 * fichero de la congregación.
 *
 * SE MIRA LO QUE PUEDE, NO CÓMO SE LLAMA
 * ---------------------------------------
 * La regla evidente era `rol !== 'miembro'`. No sirve: el pastor puede darle una
 * capacidad suelta a alguien que sigue siendo `miembro` —llevar la caja, escribir
 * el devocional— y esa persona necesita entrar. Y al revés, un rol con el jsonb
 * vaciado a mano no tiene nada que hacer allí aunque se llame `lider`.
 *
 * Mirando las capacidades efectivas, quien recibe una entra sola y quien la
 * pierde sale sola, sin que nadie tenga que acordarse de tocar esto.
 */
export function esDelEquipo(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || PERMISOS.some((p) => puede(ctx, p));
}

/**
 * Dónde empieza cada quien.
 *
 * Existe para que el destino se decida en UN sitio. Estaba escrito a mano como
 * `/panel/hoy` en tres actions —entrar, cambiar la contraseña, aceptar la
 * política—, y desde que el miembro raso vive en `/mi` eso significaba mandarle
 * al panel para que el layout lo devolviera: un rebote con su pantalla en blanco
 * por medio, que es justo lo que se ve mal.
 *
 * `null` es quien tiene sesión y no tiene iglesia: su sitio es `/mi`, que le
 * cuenta en qué punto está su solicitud.
 */
export function inicioDe(ctx: ContextoPermisos | null): string {
  if (!ctx) return '/mi';
  return esDelEquipo(ctx) ? '/panel/hoy' : '/mi';
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
  /**
   * Aquellos donde además es responsable o colíder. Siempre un subconjunto de
   * `ministerioIds`: no se puede liderar un equipo sin estar en él.
   */
  ministeriosQueLidera: string[];
}

export function puede(ctx: ContextoPermisos, permiso: Permiso): boolean {
  return ctx.permisos[permiso] === true;
}

/** ¿Es responsable o colíder de este ministerio? */
export function esLiderDe(ctx: ContextoPermisos, ministerioId: string): boolean {
  return ctx.ministeriosQueLidera.includes(ministerioId);
}

/**
 * ¿Puede tocar ESTE ministerio?
 *
 * Tres caminos que no se solapan: el pastor, quien tiene el permiso global de la
 * iglesia, y el líder acotado a los suyos. Este último cruza permiso y dato a
 * propósito: el permiso solo declara la política, y el ámbito lo pone la
 * pertenencia real al equipo.
 *
 * Lo que esto NO abre, ni al líder ni por error: crear ministerios, archivarlos
 * y cambiar quién es el responsable. A ese lo nombró el pastor; un líder puede
 * traer ayuda, no sustituirse a sí mismo y desaparecer.
 */
export function puedeGestionarMinisterio(
  ctx: ContextoPermisos,
  ministerioId: string,
): boolean {
  if (esPastor(ctx)) return true;
  if (puede(ctx, 'gestionar_ministerios')) return true;
  return puede(ctx, 'gestionar_su_ministerio') && esLiderDe(ctx, ministerioId);
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
 * ¿Puede entrar en finanzas?
 *
 * Sin ámbito que cruzar, a diferencia de los ministerios: la caja es una por
 * iglesia. Quien tiene el permiso ve toda la caja de SU congregación y ninguna
 * otra, y de eso último se encarga la RLS, no esta función.
 */
export function puedeGestionarFinanzas(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'gestionar_finanzas');
}

/**
 * ¿Puede organizar eventos?
 *
 * Como finanzas, sin ámbito que cruzar: los eventos son de la iglesia entera y
 * no de un ministerio. Un líder con `gestionar_su_ministerio` NO los ve, aunque
 * el retiro sea de su grupo — el día que haga falta acotarlo, el eje es una
 * columna `ministerio_id` en `eventos` y no un permiso más.
 */
export function puedeGestionarEventos(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'gestionar_eventos');
}

/**
 * ¿Puede borrar lo que ha escrito otro en el muro?
 *
 * El pastor siempre, por serlo. Los demás, solo con el permiso puesto a mano —
 * `moderar_comunidad` no es defecto de ningún rol, y la razón está escrita en el
 * catálogo de arriba.
 *
 * Existe como función y no como `esPastor(ctx) || puede(ctx, …)` escrito a mano
 * porque esa expresión hacía falta en tres sitios —la configuración del panel,
 * el muro y sus dos actions de borrado— y la que se olvidara de la mitad
 * derecha le enseñaría al moderador un botón que la RLS le rechaza.
 *
 * Es la única comprobación de permisos del repo que la base de datos también
 * hace por su cuenta (`puede_moderar_comunidad()`, migración `0027`). Las dos
 * miran lo mismo: el rol, o el `true` literal del jsonb.
 */
export function puedeModerarComunidad(ctx: ContextoPermisos): boolean {
  return esPastor(ctx) || puede(ctx, 'moderar_comunidad');
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
