import type { RolUsuario } from '@/lib/auth/user-context';

/**
 * Qué puede hacer cada persona dentro de un salón.
 *
 * POR QUÉ EXISTE
 * --------------
 * Hasta ahora el único predicado era `esDueno()`: o mandabas en todo o solo
 * podías mirar. Con el plan Plus y varios usuarios en el mismo negocio eso no
 * llega — el dueño necesita poder decir "a Ana sí le dejo cerrar sus tardes,
 * pero el fichero de clientes no lo toca".
 *
 * DOS PREDICADOS, NO UNO
 * ----------------------
 *   - `esAdmin(ctx)`  → administración del salón: configuración, catálogo,
 *     equipo, cobros, marketing. NO es delegable: no hay permiso que se lo dé a
 *     un empleado. Es lo que `esDueno()` ya comprobaba y por eso ese helper se
 *     queda como está, con sus 20 usos intactos.
 *   - `puede(ctx, permiso)` → las cuatro capacidades que el dueño SÍ reparte.
 *
 * DÓNDE SE GUARDAN
 * ----------------
 * En `usuarios_salon.permisos`, un jsonb que contiene SOLO EXCEPCIONES: lo que
 * el dueño ha cambiado respecto al valor por defecto del rol. Se eligió así
 * porque:
 *   - Añadir un permiso nuevo no cuesta migración, solo una clave en el
 *     catálogo de aquí abajo.
 *   - No hay que rellenar nada al desplegar: `{}` ya significa "los defectos".
 *   - Un empleado que se salga de la norma es un UPDATE de una fila.
 *
 * Y sobre todo: **`dueno` y `admin` IGNORAN el jsonb por completo**. Un UPDATE
 * mal hecho no puede dejar al dueño fuera de su propio negocio.
 *
 * EL DINERO NO SE DELEGA
 * ----------------------
 * `ver_agenda_completa` cambia lo que se VE, nunca lo que se CUENTA. Un empleado
 * con la agenda entera del salón sigue viendo solo SU facturación. De ahí que
 * `ambitoAgenda` y `ambitoCaja` sean dos funciones distintas: si el dinero se
 * derivara de la lista de citas, dar "ver toda la agenda" abriría la caja del
 * negocio por la puerta de atrás.
 */

export const PERMISOS = [
  /** Ver la agenda del salón entero, no solo sus propias citas. */
  'ver_agenda_completa',
  /** Bloquear sus propias franjas y vacaciones sin pedírselo al dueño. */
  'cerrar_franjas',
  /** Entrar al fichero de clientes, con teléfonos e historial. */
  'ver_clientes',
  /** Confirmar, cancelar o marcar no-show en citas de otro profesional. */
  'tocar_citas_ajenas',
] as const;

export type Permiso = (typeof PERMISOS)[number];
export type MapaPermisos = Record<Permiso, boolean>;

/**
 * Cómo se le cuenta cada permiso al dueño en la pantalla de Equipo.
 *
 * Vive aquí, pegado al catálogo, para que añadir un permiso obligue a escribir
 * su texto en el mismo sitio: `Record<Permiso, …>` no compila si falta uno.
 *
 * Está redactado en segunda persona y desde lo que el dueño teme —el fichero de
 * clientes, el depósito que se devuelve al cancelar— porque de eso va la
 * decisión que está tomando, no de cómo se llama la clave en base de datos.
 */
export const ETIQUETAS_PERMISOS: Record<
  Permiso,
  { titulo: string; descripcion: string }
> = {
  ver_agenda_completa: {
    titulo: 'Ver la agenda del salón entera',
    // El teléfono se nombra aquí porque viaja dentro de cada cita listada, no
    // por el fichero de clientes: un dueño que solo lee el título da esto por
    // «que vea los huecos» y acaba repartiendo los teléfonos de su cartera.
    descripcion:
      'Ve las citas de sus compañeros con nombre y teléfono del cliente, aunque no le des el fichero. Su facturación sigue siendo solo la suya.',
  },
  cerrar_franjas: {
    titulo: 'Cerrarse horas y vacaciones',
    descripcion:
      'Bloquea sus propias franjas sin pedírtelo. Solo las suyas: el salón no se cierra.',
  },
  ver_clientes: {
    titulo: 'Entrar al fichero de clientes',
    descripcion: 'Teléfonos, email e historial de cada cliente del salón.',
  },
  tocar_citas_ajenas: {
    // El título hablaba solo de "tocar" citas que ya existen, y este permiso
    // también decide si puede CREARLAS a nombre de otro — es lo que hace que en
    // "nueva cita" le salga el equipo entero en vez de solo él. Sin decirlo, un
    // dueño que quiere que su recepcionista reparta las citas del día no
    // encuentra el interruptor que se lo da, porque no busca "tocar".
    titulo: 'Dar y tocar citas de compañeros',
    descripcion:
      'Reserva a nombre de cualquiera del equipo, no solo del suyo. Y confirma, cancela o marca que no vino en citas que no son suyas. Cancelar devuelve el depósito.',
  },
};

/**
 * Lo que puede un empleado recién invitado: nada más que lo suyo. Se empieza
 * cerrado y el dueño abre lo que quiera, no al revés.
 */
export const PERMISOS_EMPLEADO_DEFECTO: MapaPermisos = {
  ver_agenda_completa: false,
  cerrar_franjas: false,
  ver_clientes: false,
  tocar_citas_ajenas: false,
};

const TODOS_CONCEDIDOS: MapaPermisos = {
  ver_agenda_completa: true,
  cerrar_franjas: true,
  ver_clientes: true,
  tocar_citas_ajenas: true,
};

/** ¿Manda en el salón? Configuración, catálogo, equipo, cobros y marketing. */
export function esAdmin(ctx: { rol: RolUsuario }): boolean {
  return ctx.rol === 'dueno' || ctx.rol === 'admin';
}

/**
 * Mapa de permisos efectivo.
 *
 * Para `dueno`/`admin` devuelve todo concedido SIN mirar lo guardado — ver el
 * comentario de cabecera. Para `empleado`, los defectos con las excepciones
 * encima; las claves que no estén en el catálogo se ignoran, así que un permiso
 * mal escrito en base de datos es inerte y no concede nada por accidente.
 */
export function resolverPermisos(
  rol: RolUsuario,
  guardados: unknown,
): MapaPermisos {
  if (esAdmin({ rol })) return { ...TODOS_CONCEDIDOS };

  const mapa = { ...PERMISOS_EMPLEADO_DEFECTO };
  if (guardados && typeof guardados === 'object' && !Array.isArray(guardados)) {
    const obj = guardados as Record<string, unknown>;
    for (const p of PERMISOS) {
      if (typeof obj[p] === 'boolean') mapa[p] = obj[p] as boolean;
    }
  }
  return mapa;
}

/**
 * El inverso de `resolverPermisos`: de lo que el dueño ha dejado marcado en el
 * formulario al jsonb mínimo que se guarda.
 *
 * Vive aquí, pegado a su inverso, porque las dos mitades tienen que estar de
 * acuerdo sobre qué es "el defecto"; separadas, cambiar un defecto arreglaría
 * la lectura y dejaría la escritura guardando el valor viejo.
 *
 * Recibe un predicado y no un mapa ya montado para que quien llama no tenga que
 * recorrer el catálogo por su cuenta —recorrerlo es justo lo que impide que una
 * casilla sin marcar (que no viaja en el FormData) se lea como "no lo toques".
 */
export function excepcionesSobreDefecto(
  estaMarcado: (permiso: Permiso) => boolean,
): Partial<Record<Permiso, boolean>> {
  const excepciones: Partial<Record<Permiso, boolean>> = {};
  for (const permiso of PERMISOS) {
    const valor = estaMarcado(permiso);
    if (valor !== PERMISOS_EMPLEADO_DEFECTO[permiso]) {
      excepciones[permiso] = valor;
    }
  }
  return excepciones;
}

/**
 * Lo mínimo que necesita cualquier comprobación de permisos. Es estructural a
 * propósito: tanto `SalonBearerContext` (app, Bearer) como `UserContext` (web,
 * cookies) lo cumplen sin herencia ni adaptadores, y así la regla se escribe
 * una vez para las dos superficies.
 */
export interface ContextoPermisos {
  rol: RolUsuario;
  permisos: MapaPermisos;
  profesionalId: string | null;
}

export function puede(ctx: ContextoPermisos, permiso: Permiso): boolean {
  return ctx.permisos[permiso] === true;
}

/**
 * Qué citas puede VER esta persona.
 *
 * `ninguno` es el caso raro pero real: una cuenta de empleado cuya ficha de
 * profesional se borró o se desvinculó (revocar y volver a invitar rompe el
 * vínculo). Se devuelve explícitamente en vez de caer a `salon`, porque fallar
 * abierto aquí significaría enseñarle la agenda entera del negocio a alguien
 * que ya no debería estar.
 */
export type AmbitoCitas =
  | { tipo: 'salon' }
  | { tipo: 'propio'; profesionalId: string }
  | { tipo: 'ninguno' };

export function ambitoAgenda(ctx: ContextoPermisos): AmbitoCitas {
  if (esAdmin(ctx)) return { tipo: 'salon' };
  if (puede(ctx, 'ver_agenda_completa')) return { tipo: 'salon' };
  if (ctx.profesionalId) return { tipo: 'propio', profesionalId: ctx.profesionalId };
  return { tipo: 'ninguno' };
}

/**
 * Sobre qué citas se suman los EUROS.
 *
 * Deliberadamente NO mira ningún permiso: la caja del negocio es del dueño y no
 * se delega. Un empleado ve lo que ha pasado por sus manos, tenga o no acceso a
 * la agenda completa.
 */
export function ambitoCaja(ctx: ContextoPermisos): AmbitoCitas {
  if (esAdmin(ctx)) return { tipo: 'salon' };
  if (ctx.profesionalId) return { tipo: 'propio', profesionalId: ctx.profesionalId };
  return { tipo: 'ninguno' };
}

/**
 * ¿Puede tocar ESTA cita? Vale tanto para cambiarle el estado (confirmar,
 * cancelar, no-show) como para crearla a nombre de un profesional.
 *
 * Cancelar dispara la devolución del depósito en Stripe, así que es de lo más
 * caro que puede hacer un empleado por error.
 */
export function puedeTocarCita(
  ctx: ContextoPermisos,
  profesionalIdDeLaCita: string | null,
): boolean {
  if (esAdmin(ctx)) return true;
  // Sin ficha de profesional no se toca NADA, ni con `tocar_citas_ajenas`
  // puesto. Es la misma cuenta a la que `ambitoAgenda` le devuelve 'ninguno':
  // la ficha se borró o se desvinculó. Con la comprobación colocada DESPUÉS del
  // permiso, alguien que ya no puede ni ver la agenda podía aun así cancelar
  // cualquier cita del salón —y cancelar devuelve el depósito por Stripe—
  // sabiendo solo el id, que viaja en los avisos push.
  //
  // Va aquí y no en cada endpoint porque el descuido era el mismo en los tres
  // sitios que llaman a esta función (estado de la cita, alta de cita desde la
  // app y las acciones del panel web).
  if (!ctx.profesionalId) return false;
  if (puede(ctx, 'tocar_citas_ajenas')) return true;
  if (!profesionalIdDeLaCita) return false;
  return ctx.profesionalId === profesionalIdDeLaCita;
}
