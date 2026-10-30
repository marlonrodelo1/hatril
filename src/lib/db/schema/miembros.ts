import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  date,
  index,
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { estadoMiembroEnum, estadoSolicitudEnum } from './enums';
import { iglesias } from './iglesias';

/**
 * La ficha de una persona de la congregación.
 *
 * DOS COSAS QUE NO SON LA MISMA
 * -----------------------------
 * `miembros` es la FICHA; `iglesia_usuarios` es la CUENTA. Se separan porque en
 * una iglesia real la mayoría de la gente no tiene (ni quiere) cuenta: el pastor
 * apunta a la señora de 80 años en el fichero y ahí se queda. Al revés también
 * pasa: alguien solicita el ingreso desde el directorio y todavía no tiene ficha.
 *
 * Cuando ambas existen se enlazan por `auth_user_id` aquí y `miembro_id` allí.
 *
 * DATOS DE CATEGORÍA ESPECIAL
 * ---------------------------
 * El simple hecho de estar en esta tabla revela la pertenencia religiosa de una
 * persona, que es dato del art. 9 del RGPD. Por eso `miembros` no se expone
 * NUNCA al rol `anon`, ni una sola columna, y su consulta queda trazada en
 * `auditoria` cuando incluye los campos marcados como sensibles más abajo.
 */
export const miembros = pgTable(
  'miembros',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** Cuenta de Supabase, si esta persona tiene acceso a la aplicación. */
    authUserId: uuid('auth_user_id'),

    /**
     * Correlativo por iglesia, no global. Lo asigna un trigger en el INSERT
     * (`asignar_numero_miembro`) para que dos altas simultáneas no compitan por
     * el mismo número; calcularlo en la aplicación con un `max()+1` es
     * exactamente la carrera que produce huecos y duplicados.
     */
    numeroMiembro: integer('numero_miembro'),

    nombre: text('nombre').notNull(),
    apellidos: text('apellidos'),
    email: text('email'),
    telefono: text('telefono'),

    // --- Campos sensibles: solo con el permiso `ver_datos_sensibles` ---
    fechaNacimiento: date('fecha_nacimiento'),
    direccion: text('direccion'),
    ciudad: text('ciudad'),
    estadoCivil: text('estado_civil'),
    /**
     * Notas administrativas. NO es el seguimiento pastoral: eso llega en la v2
     * con su propia tabla y su propio cifrado, porque incluye datos de salud y
     * de situación personal que no pueden compartir superficie con esto.
     */
    notas: text('notas'),

    fotoUrl: text('foto_url'),

    estado: estadoMiembroEnum('estado').notNull().default('visitante'),
    bautizado: boolean('bautizado').notNull().default(false),
    fechaBautismo: date('fecha_bautismo'),
    fechaIngreso: date('fecha_ingreso'),

    /**
     * Alimenta la columna "Última vez" del listado del diseño. Se actualiza
     * desde el módulo de asistencias (v2); en la v1 se escribe a mano.
     */
    ultimaAsistencia: date('ultima_asistencia'),

    /**
     * Baja lógica. No se borra la fila al dar de baja para no romper el
     * histórico de ministerios, pero el borrado REAL sí existe: lo dispara el
     * derecho de supresión del RGPD, y ahí sí desaparece todo.
     */
    archivadoAt: timestamp('archivado_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('miembros_iglesia_numero_unique').on(t.iglesiaId, t.numeroMiembro),
    // Toda policy de RLS filtra por `iglesia_id`: sin índice, seq scan.
    index('idx_miembros_iglesia').on(t.iglesiaId),
    index('idx_miembros_auth').on(t.authUserId),
    // El listado por defecto ordena por estado y nombre dentro de la iglesia.
    index('idx_miembros_iglesia_estado').on(t.iglesiaId, t.estado),
    index('idx_miembros_email').on(t.iglesiaId, t.email),
  ],
);

/**
 * Petición de una persona para unirse a una iglesia desde el directorio público.
 *
 * Es la puerta de entrada elegida: la persona busca su congregación y un líder
 * aprueba. Mientras la solicitud esté `pendiente`, quien la envió no ve NADA de
 * la iglesia — la membresía se queda en `pendiente` y las policies exigen
 * `activo`. Sin ese matiz, solicitar el ingreso sería equivalente a entrar.
 */
export const solicitudesIngreso = pgTable(
  'solicitudes_ingreso',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    authUserId: uuid('auth_user_id').notNull(),

    /** Se copian del formulario: la ficha aún no existe cuando esto se crea. */
    nombre: text('nombre').notNull(),
    email: text('email'),
    telefono: text('telefono'),
    /** Opcional. Pasa a la ficha al aprobar, como el teléfono. */
    direccion: text('direccion'),
    mensaje: text('mensaje'),

    /**
     * La casilla de asistencia y seguimiento, la misma de `/acepta`, tal como la
     * dejó al enviar. Al aprobar se convierte en una fila de `consentimientos`
     * —o no— porque hasta entonces no hay ficha a la que colgarla.
     *
     * Existe porque aprobar registraba el consentimiento general en la versión
     * vigente y ninguno de asistencia, y `miembrosSinPermisoDeAsistencia` lee
     * esa combinación como «lo vio en `/acepta` y dijo que no». Toda persona
     * aprobada desaparecía de las listas sin haber dicho nada.
     *
     * NULL, y no `default false`, a propósito: NULL es «no se le preguntó», el
     * caso de las solicitudes enviadas antes de la `0040`. Un `false` por defecto
     * las habría convertido en un «no» que nadie dijo, y al enlazar ese «no»
     * borra el historial de la ficha. `/solicitar` siempre escribe true o false.
     */
    aceptaAsistencia: boolean('acepta_asistencia'),
    /**
     * `VERSION_POLITICA_PRIVACIDAD` cuando la envió: a qué texto dijo que sí.
     *
     * Aprobar puede llegar semanas después, con la política ya cambiada.
     * Registrar entonces la versión vigente diría que aceptó un texto que no
     * leyó, y además le ahorraría `/acepta`, que es quien se lo pregunta otra
     * vez. Con la suya, si se ha quedado vieja, la pantalla salta sola.
     *
     * NULL es «no consta», y aprobar no registra nada con él. Lo tienen las
     * filas que no pasaron por `/solicitar` después de la `0040` —la semilla—
     * y, a propósito, las enviadas entre la subida a `privacidad-2026-09` y la
     * `0040`: la migración cuenta por qué.
     */
    versionTexto: text('version_texto'),

    estado: estadoSolicitudEnum('estado').notNull().default('pendiente'),
    revisadoPor: uuid('revisado_por'),
    revisadoAt: timestamp('revisado_at', { withTimezone: true }),
    motivoRechazo: text('motivo_rechazo'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // Una persona no puede tener dos solicitudes VIVAS en la misma iglesia.
    // Parcial a propósito: sí debe poder volver a solicitar si la primera se
    // rechazó y luego se aclaró el malentendido, cosa que un unique a secas
    // impediría para siempre.
    uniqueIndex('uq_solicitudes_pendiente_por_persona')
      .on(t.iglesiaId, t.authUserId)
      .where(sql`estado = 'pendiente'`),
    index('idx_solicitudes_iglesia_estado').on(t.iglesiaId, t.estado),
    index('idx_solicitudes_auth').on(t.authUserId),
  ],
);
