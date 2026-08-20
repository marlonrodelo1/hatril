import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';

/**
 * Los avisos de una persona dentro de una iglesia.
 *
 * EL DESTINATARIO ES LA CUENTA, NO LA FICHA
 * -----------------------------------------
 * En el resto del repo las cosas se firman con `miembros` —el liderazgo, el
 * devocional, la publicación— porque son cosas que hace una PERSONA de la
 * congregación, y esa persona tiene ficha aunque no tenga acceso.
 *
 * Un aviso es lo contrario: solo sirve si alguien puede abrirlo, así que va a la
 * cuenta. Además hay un caso que la ficha no cubre: «tu solicitud ha sido
 * aprobada» se envía a quien todavía no es miembro de nada. Con `miembro_id` esa
 * notificación —la primera que recibe cualquiera— no se podría ni escribir.
 *
 * QUIÉN LAS ESCRIBE
 * -----------------
 * Solo el servidor, con `dbAdmin`. No hay policy de INSERT para `hatril_app` y
 * es a propósito: si una sesión pudiera insertar, cualquier miembro podría
 * fabricarse un «el pastor ha aprobado tu solicitud» o mandarle a otro un aviso
 * falso con un enlace a donde quisiera. Es el mismo criterio que con
 * `auditoria`, que la aplicación lee y nunca escribe.
 */
export const tipoNotificacionEnum = pgEnum('tipo_notificacion_enum', [
  'solicitud_recibida',
  'solicitud_aprobada',
  'solicitud_rechazada',
  'comentario_en_publicacion',
  'me_gusta_en_publicacion',
  'turno_devocional',
]);

export const notificaciones = pgTable(
  'notificaciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /** A quién va. Es un `auth.users.id`; sin FK, igual que en el resto del repo. */
    destinatarioAuthUserId: uuid('destinatario_auth_user_id').notNull(),

    tipo: tipoNotificacionEnum('tipo').notNull(),

    /**
     * Con qué se rellena el texto: el nombre de quien comentó, el título de la
     * publicación, la fecha del turno.
     *
     * El TEXTO no se guarda, se compone al pintarlo. Guardado, cambiar una
     * palabra obligaría a reescribir las filas viejas, y las que ya estuvieran
     * enviadas seguirían diciendo lo de antes para siempre. Guardando los datos,
     * el texto es cosa de la aplicación y se corrige en un despliegue.
     */
    datos: jsonb('datos')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),

    /** A dónde lleva al pulsarla. Ruta interna, nunca una URL de fuera. */
    enlace: text('enlace'),

    /**
     * Cuándo se leyó. `null` es «sin leer», que es lo que cuenta la campana.
     *
     * Una marca de tiempo y no un booleano: ocupa lo mismo y contesta además a
     * «¿cuánto tarda la gente en enterarse?», que es justo lo que habrá que
     * mirar el día que se decida si hace falta mandarlo también por correo.
     */
    leidaAt: timestamp('leida_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // La consulta de siempre: mis avisos, los últimos arriba. El índice lleva
    // `iglesia_id` porque una cuenta puede estar en dos congregaciones.
    index('idx_notificaciones_destinatario').on(
      t.destinatarioAuthUserId,
      t.iglesiaId,
      t.createdAt.desc(),
    ),
    // Y el contador de la campana, que se pide en cada carga del panel.
    index('idx_notificaciones_sin_leer')
      .on(t.destinatarioAuthUserId, t.iglesiaId)
      .where(sql`${t.leidaAt} is null`),
  ],
);
