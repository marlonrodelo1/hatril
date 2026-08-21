import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Enums de Postgres, declarados aparte para poder reutilizarlos entre ficheros
 * de schema sin crear ciclos de importación.
 *
 * Se usan `pgEnum` y no `text` + CHECK porque aquí los valores son cerrados y
 * estables. Pidoo dejó `estado` como texto libre y acabó con `'pagada'` y
 * `'pagado'` conviviendo en la misma columna, y filas que ningún filtro recogía.
 *
 * Contrapartida conocida: quitar un valor de un enum en Postgres es incómodo.
 * Por eso los enums de aquí describen estados del dominio (que casi nunca se
 * borran), y lo que sí muta —los planes de precio— vive en variables de entorno,
 * no en la base de datos.
 */

/**
 * Rol dentro de una iglesia.
 *
 * `pastor` es el equivalente al dueño: manda en todo y no se le puede quitar
 * nada por configuración. Los demás son delegaciones parciales; qué implica cada
 * uno está en `src/lib/auth/permisos.ts`, no aquí.
 *
 * `miembro` es el rol de la aplicación móvil: entra, ve lo suyo y lo que su
 * iglesia publica. Es el rol por defecto de quien llega por el directorio.
 */
export const rolIglesiaEnum = pgEnum('rol_iglesia_enum', [
  'pastor',
  'lider',
  'tesorero',
  'secretaria',
  'miembro',
]);

/**
 * Estado del vínculo entre una cuenta y una iglesia.
 *
 * `pendiente` es el estado en el que entra quien solicita unirse desde el
 * directorio público. Mientras esté así **no ve absolutamente nada** de la
 * congregación: las policies de RLS exigen `activo`, no la simple existencia de
 * la fila. Esa distinción es la que sostiene el requisito del art. 9 del RGPD.
 */
export const estadoMembresiaEnum = pgEnum('estado_membresia_enum', [
  'pendiente',
  'activo',
  'rechazado',
  'baja',
]);

/**
 * Autoridad dentro de un ministerio.
 *
 * NO confundir con `ministerio_miembros.rol_en_ministerio`, que es texto libre y
 * describe la FUNCIÓN («Vocalista», «Clase de 3 a 6 años»). Son los dos ejes de
 * siempre: uno dice qué hace la persona y el otro qué manda.
 *
 * `responsable` es único por ministerio, y lo garantiza un índice parcial, no la
 * aplicación. `colider` existe porque un ministerio de niños con cuarenta críos
 * lo llevan tres personas, y hasta la migración `0005` solo cabía una.
 */
export const rolEquipoEnum = pgEnum('rol_equipo_enum', [
  'responsable',
  'colider',
  'voluntario',
]);

export type RolEquipo = (typeof rolEquipoEnum.enumValues)[number];

/**
 * Situación de una persona respecto a la congregación.
 *
 * Los valores salen literalmente de los badges del sistema de diseño
 * (`Sistema de diseño.dc.html`): Visitante, Nuevo, Activo, Pendiente. Se
 * nombran desde el dominio de la iglesia, no desde el de la aplicación.
 */
export const estadoMiembroEnum = pgEnum('estado_miembro_enum', [
  'visitante',
  'nuevo',
  'miembro',
  'inactivo',
  'baja',
]);

/**
 * Plan de suscripción de la iglesia.
 *
 * Los nombres viven aquí; los PRECIOS no. Van en variables de entorno
 * (`STRIPE_PRICE_*`) porque el precio de este mercado todavía está por validar
 * —la competencia va de 9 a 70 USD/mes escalados por número de miembros— y
 * cambiarlo no debe requerir migración ni despliegue.
 */
export const planEnum = pgEnum('plan_enum', [
  'trial',
  'esencial',
  'comunidad',
  'plus',
  'cancelado',
]);

/**
 * Moneda de la iglesia. Determina cómo se formatean los importes, no dónde se
 * cobra: la suscripción se cobra siempre en la moneda del precio de Stripe.
 */
/**
 * Quién puede publicar en el muro de la congregación.
 *
 * No es lo mismo que un permiso del catálogo: los permisos dicen qué puede
 * hacer una PERSONA, y esto lo decide la iglesia entera de una vez. Una
 * congregación de trescientas que abre el muro a todo el mundo y otra de
 * cuarenta donde solo escribe el pastor son dos productos distintos, y la
 * diferencia no cabe en el mapa de permisos por persona.
 *
 *   `todos`  — cualquier miembro con ficha. Es el defecto y lo que había antes
 *              de que esto existiera, así que las iglesias que ya usan el muro
 *              no notan el cambio.
 *   `equipo` — quien tiene un rol distinto de `miembro`: pastor, líder,
 *              tesorero y secretaría.
 *   `pastor` — solo el pastor. El muro pasa a ser un tablón de anuncios.
 *
 * Comentar y dar me gusta NO dependen de esto: van por su propio interruptor.
 * Una iglesia puede querer que solo publique el equipo y que responda todo el
 * mundo, que es exactamente el tablón parroquial de toda la vida.
 */
export const comunidadQuienPublicaEnum = pgEnum(
  'comunidad_quien_publica_enum',
  ['todos', 'equipo', 'pastor'],
);

export const monedaEnum = pgEnum('moneda_enum', ['COP', 'EUR', 'USD']);

/** Mismo patrón que `RolEquipo`: el tipo sale de la lista, no se escribe aparte. */
export type Moneda = (typeof monedaEnum.enumValues)[number];

export const estadoSolicitudEnum = pgEnum('estado_solicitud_enum', [
  'pendiente',
  'aprobada',
  'rechazada',
]);

/**
 * Tipos de consentimiento que se registran por separado.
 *
 * `datos_religiosos` es el del art. 9.2.a del RGPD y es el único obligatorio:
 * sin él no se puede tratar la pertenencia a una congregación. Los otros dos son
 * opcionales y revocables por su cuenta — de ahí que sean filas distintas y no
 * un único booleano "acepta todo", que no distinguiría qué revocó la persona.
 */
export const tipoConsentimientoEnum = pgEnum('tipo_consentimiento_enum', [
  'datos_religiosos',
  'comunicaciones',
  'imagen',
  /**
   * Que se apunte a qué reuniones viene y qué se habla con ella cuando lleva
   * tiempo sin aparecer.
   *
   * Casilla separada de `datos_religiosos` a propósito: aquél dice que los
   * datos se guardan «para que la congregación pueda organizarse», y eso no
   * cubre un registro nominal y semanal de dónde estuvo cada persona. Art. 7.2,
   * granularidad. El porqué de que sea UN valor y no dos, y qué pasa con quien
   * se niega, están en la migración `0034`.
   */
  'asistencia_y_seguimiento',
]);

/**
 * Qué se registra en la auditoría.
 *
 * `lectura_sensible` existe porque con datos de categoría especial no basta con
 * saber quién los cambió: hay que poder responder quién los CONSULTÓ. Es el
 * único evento de lectura que se traza, y solo sobre las vistas que exponen
 * datos protegidos.
 */
export const accionAuditoriaEnum = pgEnum('accion_auditoria_enum', [
  'alta',
  'modificacion',
  'baja',
  'lectura_sensible',
]);
