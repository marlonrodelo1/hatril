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
export const monedaEnum = pgEnum('moneda_enum', ['COP', 'EUR', 'USD']);

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
