import { pgTable, uuid, text, timestamp, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Los teléfonos de cada cuenta que pueden recibir notificaciones push.
 *
 * DE LA CUENTA, NO DE LA IGLESIA
 * ------------------------------
 * Igual que `notificaciones`: un aviso solo sirve si alguien puede abrirlo, y
 * quien lo abre es una cuenta en un teléfono. Por eso no lleva `iglesia_id`, y
 * la policy es la cuenta y nada más (migración 0057).
 *
 * UN TOKEN, UN DUEÑO
 * ------------------
 * El token es la clave primaria. Si en un teléfono sale una cuenta y entra
 * otra, el mismo token pasa a la segunda: con dos filas, los avisos de la
 * primera seguirían llegando a una pantalla que ya es de otra persona, con su
 * nombre y el de quien le comenta. Mover el token de cuenta no lo puede hacer
 * `hatril_app` —la fila vieja no es suya y la RLS no le deja verla—, así que
 * se registra con `registrar_dispositivo_push()`, que lo hace en un solo paso.
 *
 * QUIÉN LA LEE
 * ------------
 * Cada cuenta, las suyas, para borrar la de este teléfono al salir. Mandar el
 * aviso necesita los teléfonos de OTRA cuenta, y eso va por `dbAdmin` desde
 * `lib/push/enviar.ts`, en el mismo sitio que ya escribe la notificación.
 */
export const dispositivosPush = pgTable(
  'dispositivos_push',
  {
    token: text('token').primaryKey(),

    authUserId: uuid('auth_user_id').notNull(),

    plataforma: text('plataforma').notNull(),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * La última vez que la app dijo «sigo aquí». Firebase da por muerto un
     * token a los 270 días sin uso; con esto se pueden limpiar los que nadie
     * abre, aunque nunca lleguen a fallar.
     */
    vistoAt: timestamp('visto_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('idx_dispositivos_push_cuenta').on(t.authUserId),
    check('ck_dispositivos_push_plataforma', sql`${t.plataforma} in ('ios', 'android')`),
    // Un token de FCM ronda los 160 caracteres. El tope es para que nadie
    // guarde aquí un libro por la puerta de registrar.
    check('ck_dispositivos_push_token', sql`length(${t.token}) between 20 and 4096`),
  ],
);
