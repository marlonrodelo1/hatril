import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Solo el TIPO: `import type` desaparece al compilar, así que no crea ciclo en
// tiempo de ejecución aunque `permisos.ts` dependa a su vez de este fichero.
// Ruta relativa y no el alias `@/`: drizzle-kit compila estos ficheros con su
// propio esbuild y no siempre resuelve los paths del tsconfig.
import type { Permiso } from '../../auth/permisos';

import {
  estadoMembresiaEnum,
  monedaEnum,
  planEnum,
  rolIglesiaEnum,
} from './enums';

/**
 * Una fila del cuadro de horarios de la web pública.
 *
 * `destacado` marca la reunión a la que se dirige a quien viene por primera
 * vez. Es la pregunta que trae a alguien a la web de una iglesia —«¿cuándo y
 * dónde os reunís?»— y con cuatro horarios seguidos sin jerarquía no se
 * responde.
 */
export type HorarioSemanal = {
  dia: string;
  hora: string;
  nombre: string;
  detalle?: string;
  destacado?: boolean;
};

/**
 * La iglesia. Es el tenant: todo dato de negocio cuelga de aquí.
 */
export const iglesias = pgTable(
  'iglesias',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Clave pública del tenant. Aparece en `/i/[slug]` y en el directorio, así
     * que se genera desde el nombre y se garantiza único al crear la iglesia
     * (`src/lib/onboarding/crear-iglesia.ts`).
     */
    slug: text('slug').notNull(),

    nombre: text('nombre').notNull(),
    /** Bautista, pentecostal, cuadrangular… Texto libre: hay cientos y no paran. */
    denominacion: text('denominacion'),
    descripcion: text('descripcion'),

    // Ubicación. `pais` en ISO-3166 alfa-2 para poder segmentar sin ambigüedad.
    pais: text('pais').notNull().default('CO'),
    ciudad: text('ciudad'),
    direccion: text('direccion'),

    /**
     * Zona horaria IANA. Por defecto Bogotá porque es el mercado inicial.
     * Se guarda por iglesia y no global: una plataforma que sirve a Colombia y
     * España no puede calcular "hoy" desde el servidor.
     */
    timezone: text('timezone').notNull().default('America/Bogota'),
    moneda: monedaEnum('moneda').notNull().default('COP'),

    telefono: text('telefono'),
    email: text('email'),
    web: text('web'),
    redes: jsonb('redes').$type<Record<string, string>>().notNull().default({}),

    logoUrl: text('logo_url'),
    bannerUrl: text('banner_url'),

    // --- Contenido de la web pública (`/i/[slug]`) ---------------------------

    /**
     * ¿Está publicada la web de la iglesia?
     *
     * Separado de `visible_en_directorio`: tener página propia y salir en el
     * buscador de Hatril son dos decisiones distintas. Una congregación puede
     * querer una web que enseñar a quien pregunta sin aparecer en un listado.
     */
    webPublica: boolean('web_publica').notNull().default(false),

    /** El «quiénes somos». Texto largo, en párrafos separados por líneas en blanco. */
    historia: text('historia'),

    /**
     * Horarios semanales.
     *
     * En jsonb y no en una tabla propia: son cuatro o cinco filas de contenido
     * de página, no una entidad del dominio con la que nadie va a cruzar datos.
     * Una tabla obligaría a una consulta más en cada visita y a un CRUD entero
     * para algo que se edita dos veces al año.
     *
     * Los eventos con fecha SÍ serán una tabla; eso es otra cosa y llega en v2.
     */
    horarios: jsonb('horarios')
      .$type<HorarioSemanal[]>()
      .notNull()
      .default([]),

    /**
     * Cuenta para donativos, tal como la publica la iglesia.
     *
     * Es un dato que las congregaciones ya ponen en su web y en el boletín. Se
     * guarda como texto porque hay IBAN, Nequi, Daviplata y cuentas de ahorros
     * según el país, y validar formatos aquí solo serviría para rechazar los
     * que no conocemos.
     *
     * Hatril NO cobra ni intermedia: solo muestra el número.
     */
    cuentaDonativos: text('cuenta_donativos'),
    titularDonativos: text('titular_donativos'),

    /**
     * Dominio propio de la iglesia. `src/proxy.ts` lo resuelve a `/i/[slug]`.
     */
    dominioPropio: text('dominio_propio'),

    /**
     * ¿Aparece en el directorio público de `/iglesias`?
     *
     * Arranca en `false` a propósito. Que una congregación exista en Hatril no
     * la hace pública: publicarse es una decisión suya, y con datos del art. 9
     * el defecto tiene que ser el cerrado.
     */
    visibleEnDirectorio: boolean('visible_en_directorio')
      .notNull()
      .default(false),

    /**
     * ¿Acepta solicitudes de ingreso desde el directorio?
     *
     * Separado de la visibilidad porque son decisiones distintas: una iglesia
     * puede querer su ficha pública pero gestionar las altas ella misma.
     */
    aceptaSolicitudes: boolean('acepta_solicitudes').notNull().default(true),

    // Suscripción. Los precios NO están aquí: ver `enums.ts`.
    plan: planEnum('plan').notNull().default('trial'),
    trialUntil: timestamp('trial_until', { withTimezone: true }),
    stripeCustomerId: text('stripe_customer_id'),
    stripeSubscriptionId: text('stripe_subscription_id'),

    activa: boolean('activa').notNull().default(true),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('iglesias_slug_unique').on(t.slug),
    unique('iglesias_dominio_propio_unique').on(t.dominioPropio),
    // Parcial: el directorio solo lista las visibles y activas, y es la consulta
    // pública más caliente del sistema.
    index('idx_iglesias_directorio')
      .on(t.pais, t.ciudad)
      .where(sql`visible_en_directorio = true AND activa = true`),
    index('idx_iglesias_stripe_customer').on(t.stripeCustomerId),
  ],
);

/**
 * Quién pertenece a qué iglesia y con qué rol.
 *
 * Esta tabla es la que Pidoo no tiene, y le duele: allí el dueño de un
 * restaurante es una columna `establecimientos.user_id`, así que un negocio no
 * puede tener dos administradores. Una iglesia tiene pastor, varios líderes,
 * tesorero y secretaría desde el primer día.
 *
 * Es además el eje de toda la seguridad: las policies de RLS preguntan por esta
 * tabla (`pertenece_a_iglesia()`), y exigen `estado = 'activo'`.
 */
export const iglesiaUsuarios = pgTable(
  'iglesia_usuarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    /**
     * `auth.users.id` de Supabase. Sin FK declarada: `auth` es un esquema que
     * gestiona Supabase y encadenar el borrado desde aquí es frágil. La
     * integridad se mantiene con el trigger de alta y el borrado de cuenta.
     */
    authUserId: uuid('auth_user_id').notNull(),

    rol: rolIglesiaEnum('rol').notNull().default('miembro'),

    /**
     * Excepciones a los permisos por defecto del rol. `{}` = los defectos.
     * `pastor` lo ignora por completo — ver `src/lib/auth/permisos.ts`.
     * Nunca leer una clave de aquí a pelo desde fuera de ese módulo.
     */
    permisos: jsonb('permisos')
      .$type<Partial<Record<Permiso, boolean>>>()
      .notNull()
      .default({}),

    estado: estadoMembresiaEnum('estado').notNull().default('pendiente'),

    /**
     * Ficha de miembro asociada, si la hay. Es opcional en los dos sentidos:
     * hay miembros sin cuenta (la señora que no usa el móvil) y cuentas sin
     * ficha todavía (acaba de solicitar el ingreso).
     */
    miembroId: uuid('miembro_id'),

    aprobadoPor: uuid('aprobado_por'),
    aprobadoAt: timestamp('aprobado_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('iglesia_usuarios_iglesia_auth_unique').on(t.iglesiaId, t.authUserId),
    // Lo consulta CADA policy de RLS a través de `pertenece_a_iglesia()`.
    // Sin este índice, todo el sistema hace seq scan en cada fila comprobada.
    index('idx_iglesia_usuarios_auth').on(t.authUserId),
    index('idx_iglesia_usuarios_iglesia').on(t.iglesiaId),
    index('idx_iglesia_usuarios_miembro').on(t.miembroId),
  ],
);
