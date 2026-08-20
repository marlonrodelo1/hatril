import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  boolean,
  integer,
  timestamp,
  inet,
  index,
  uniqueIndex,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { iglesias } from './iglesias';

/**
 * Los eventos de la iglesia y quién se apunta.
 *
 * LO QUE HACE DISTINTO A ESTE MÓDULO DE TODOS LOS ANTERIORES
 * ----------------------------------------------------------
 * Es la PRIMERA vez que Hatril guarda datos personales de alguien que no tiene
 * cuenta, no tiene ficha y no ha pedido entrar en ninguna congregación. Hasta
 * hoy no existía ni un camino así: `solicitudes_ingreso.auth_user_id` es NOT
 * NULL y `solicitarIngreso` echa a `/acceso` a quien no tiene sesión.
 *
 * Y el dato no es menor por ser de un desconocido: apuntarse a un acto de una
 * congregación dice algo de las creencias de quien se apunta. Es el mismo
 * argumento que este repo ya escribió sobre el muro de la comunidad. Art. 9 del
 * RGPD, base 9.2.a y solo esa: no hay contrato con esta persona, y la excepción
 * de entidad religiosa del 9.2.d habla de miembros o de quien mantiene contacto
 * regular, no de quien va a un concierto una vez.
 *
 * De ahí salen las tres rarezas de este fichero: `consentimiento_version` es NOT
 * NULL, `origen` distingue quién puso la fila, y `evento_inscripciones` NO lleva
 * trigger de auditoría (el porqué, en la cabecera de la `0023`).
 *
 * EL COBRO NO PASA POR HATRIL, Y ESO ES UNA DECISIÓN DE PRODUCTO
 * --------------------------------------------------------------
 * No hay pasarela, no hay comisión, no hay conciliación. El pastor pega SU
 * enlace y marca a mano quién pagó. `pagado` es una anotación suya, no un hecho
 * verificado. Un evento cobrado tampoco genera un asiento en el libro de caja:
 * si algún día lo genera será porque el tesorero lo apunte.
 */

/**
 * Quién puso la fila de inscripción.
 *
 * No es cosmético: separa dos situaciones jurídicas distintas. En `publico` la
 * persona interesada marcó la casilla ella misma y hay evidencia técnica (IP y
 * navegador). En `panel` la apuntó alguien de la iglesia porque llamó por
 * teléfono, y la evidencia del consentimiento la tiene la congregación fuera de
 * Hatril — por eso un `panel` NO puede llevar IP ni navegador, y lo impone un
 * CHECK: guardar la IP del pastor como si fuera la del inscrito sería fabricar
 * una prueba falsa del art. 7.1.
 */
export const origenInscripcionEnum = pgEnum('origen_inscripcion_enum', [
  'publico',
  'panel',
]);

export const eventos = pgTable(
  'eventos',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    titulo: text('titulo').notNull(),
    descripcion: text('descripcion'),

    /**
     * `timestamptz`, y NO `date` + `time` como hace `movimientos.fecha`.
     *
     * Allí la razón era buena: la ofrenda del culto del domingo es del domingo,
     * no de las 11:47:03 UTC, y con marca de tiempo el mes cerraba descuadrado.
     * Aquí no aplica, porque un evento no es un día contable: es un instante al
     * que alguien se presenta.
     *
     * Lo que decide es otra cosa. El corte de inscripción y el aforo se
     * comprueban DENTRO de `inscribir_en_evento`, en plpgsql, donde no existe
     * `hoyEnLaIglesia(ctx.iglesia.timezone)`. Con `date` + `time` esa función
     * tendría que unir `iglesias` y convertir con `at time zone` fila a fila,
     * perdiendo el índice; con `timestamptz` es `e.inicio_en > now()`.
     *
     * El precio se paga arriba: el formulario del panel recibe hora de pared y
     * la convierte con `fechaLocalATimestamp` de `src/lib/fecha/zona.ts`. Y al
     * PINTAR siempre se formatea con `timeZone: iglesia.timezone`, nunca con el
     * huso del servidor.
     */
    inicioEn: timestamp('inicio_en', { withTimezone: true }).notNull(),

    /**
     * Cuándo termina, si dura más de un rato.
     *
     * Existe por el retiro de tres días: sin esto, la web pública lo dejaría de
     * mostrar la primera mañana, cuando `inicio_en` ya pasó y la gente todavía
     * está allí. Las consultas de «lo próximo» filtran por
     * `coalesce(fin_en, inicio_en)`.
     */
    finEn: timestamp('fin_en', { withTimezone: true }),

    lugar: text('lugar'),
    imagenUrl: text('imagen_url'),

    /**
     * Cadena, no número, exactamente por lo mismo que `movimientos.importe`:
     * sale de postgres-js como texto y se deja así para que nadie lo sume con
     * `Number()`. `null` es gratis, y `'0.00'` NO es lo mismo que gratis:
     * enseñar «0 COP» junto a un botón de pagar es un producto roto, y el CHECK
     * impide que llegue a existir.
     *
     * Sin columna `moneda`: la moneda es de la iglesia (`iglesias.moneda`). Un
     * evento en otra moneda que su congregación no es un caso real, y una
     * segunda columna sería una segunda ruta de formateo.
     */
    precio: numeric('precio', { precision: 14, scale: 2 }),

    /**
     * Plazas. `null` = sin límite.
     *
     * Se cuentan PERSONAS, no filas: cada fila trae hasta diez acompañantes, así
     * que un cupo de 50 contado por filas admitiría 550 asistentes. Lo hace
     * cumplir `inscribir_en_evento` con `sum(1 + acompanantes)` bajo cerrojo, y
     * no la aplicación: un aforo es un agregado, y no hay CHECK ni unique que
     * defienda un agregado.
     */
    cupo: integer('cupo'),

    publicado: boolean('publicado').notNull().default(false),

    /**
     * Separado de `publicado` a propósito, y es el mismo par que `web_publica` /
     * `visible_en_directorio`: anunciar un evento y admitir inscripciones son
     * dos decisiones. La iglesia quiere seguir anunciando el retiro cuando ya no
     * quedan plazas.
     */
    inscripcionesAbiertas: boolean('inscripciones_abiertas')
      .notNull()
      .default(false),

    /**
     * El enlace de pago que pega el pastor. Stripe Payment Link, Wompi, Nequi,
     * el TPV de su banco.
     *
     * SIN LISTA BLANCA, Y ESO SE APARTA DE `videoUrl` Y DE LAS REDES
     * --------------------------------------------------------------
     * En `devocionales.videoUrl` y en `redes.ts` la lista cerrada se podía
     * escribir de verdad. Aquí el destino es la pasarela que la caja local de
     * una congregación colombiana saque el año que viene. Una lista blanca no
     * protegería: garantizaría que el primer pastor con un medio que no
     * conocemos no pueda cobrar.
     *
     * LO QUE SÍ SE COMPRUEBA, PORQUE ES LO QUE HACE DAÑO
     * --------------------------------------------------
     * El enlace acaba en un `href` de la web PÚBLICA de la iglesia:
     *   - Solo `https:`. No se enumeran los protocolos prohibidos, se admite
     *     uno: enumerar lo malo deja fuera lo de mañana.
     *   - `new URL()` tiene que entenderlo, o un `//otro.host/pagar` relativo se
     *     resolvería contra el dominio de la iglesia.
     *   - `url.username` y `url.password` vacíos. Esto solo:
     *     `https://buy.stripe.com@evil.com/x` tiene hostname `evil.com`, y quien
     *     pinte el host cortando la cadena mostraría Stripe.
     *   - NO se antepone `https://` a ciegas como hacen las redes: un
     *     «bizum 600123456» se convertiría en una dirección válida que no lleva
     *     a ninguna parte, y el pastor no se enteraría hasta que alguien le
     *     dijera que no puede pagar. Para eso está `pagoInstrucciones`.
     */
    enlacePago: text('enlace_pago'),

    /**
     * El host de `enlace_pago`, escrito por el SERVIDOR con `new URL().hostname`
     * y nunca a mano.
     *
     * Existe para que la web pública pueda decirle al feligrés a dónde va antes
     * de que pulse —«Pagar en checkout.wompi.co»— sin volver a parsear la URL en
     * cada render y, sobre todo, sin poder equivocarse. Que los dos campos no se
     * puedan contradecir lo garantiza `ck_eventos_enlace_host`, es decir la base
     * de datos.
     *
     * El control del lado del pastor no protege a la víctima: el pastor ve el
     * host al pegarlo, el feligrés solo ve «Pagar la inscripción». Esta columna
     * es la mitad que sí ve la víctima.
     */
    enlacePagoHost: text('enlace_pago_host'),

    /**
     * Bizum, Nequi por teléfono, número de cuenta.
     *
     * NO son URL y no deben serlo: forzarlas a una dirección https produce
     * enlaces que no llevan a ningún sitio. Se pintan como TEXTO, nunca dentro
     * de un `href`, y ese es el motivo de que existan aparte del enlace.
     */
    pagoInstrucciones: text('pago_instrucciones'),

    /**
     * Quién lo creó. Uuid pelado sin FK, igual que
     * `movimientos.registrado_por_miembro_id` y `devocionales.autor_miembro_id`,
     * con la coherencia por trigger (HT113).
     */
    creadoPorMiembroId: uuid('creado_por_miembro_id'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check('ck_eventos_titulo_len', sql`length(${t.titulo}) between 1 and 140`),
    check(
      'ck_eventos_descripcion_len',
      sql`${t.descripcion} is null or length(${t.descripcion}) <= 4000`,
    ),
    check(
      'ck_eventos_lugar_len',
      sql`${t.lugar} is null or length(${t.lugar}) <= 160`,
    ),
    check(
      'ck_eventos_pago_instrucciones_len',
      sql`${t.pagoInstrucciones} is null or length(${t.pagoInstrucciones}) <= 300`,
    ),

    // Un retiro que termina antes de empezar es un error de dedo que luego hace
    // desaparecer el evento de la web sin que nadie entienda por qué.
    check(
      'ck_eventos_fin_despues',
      sql`${t.finEn} is null or ${t.finEn} >= ${t.inicioEn}`,
    ),

    check('ck_eventos_precio', sql`${t.precio} is null or ${t.precio} > 0`),
    check('ck_eventos_cupo', sql`${t.cupo} is null or ${t.cupo} > 0`),

    // Cinturón en la base de lo que la aplicación ya valida. `javascript:` y
    // `data:` en la web pública de una congregación son XSS y phishing con su
    // membrete; que dependa solo de una server action es lo que este repo no
    // hace.
    check(
      'ck_eventos_enlace_https',
      sql`${t.enlacePago} is null or ${t.enlacePago} like 'https://%'`,
    ),

    /*
     * El host guardado y la URL no se pueden contradecir.
     *
     * `position('https://' || host || '/' in url) = 1` obliga a que la URL
     * empiece por el host que se le va a enseñar al feligrés. Un
     * `https://buy.stripe.com@evil.com/x` guardado con host 'buy.stripe.com' NO
     * pasa, porque el host real que devuelve `new URL()` es `evil.com`. Exige
     * además que la URL lleve al menos una barra de ruta, que es lo que produce
     * siempre `new URL().toString()`.
     */
    check(
      'ck_eventos_enlace_host',
      sql`(${t.enlacePago} is null and ${t.enlacePagoHost} is null)
          or (${t.enlacePagoHost} is not null
              and position('https://' || ${t.enlacePagoHost} || '/' in ${t.enlacePago}) = 1)`,
    ),

    // La consulta del panel y la de la web pública son la misma forma.
    index('idx_eventos_iglesia_inicio').on(t.iglesiaId, t.inicioEn),

    // Parcial: la web pública solo pide publicados, y son minoría frente al
    // histórico completo de una iglesia con tres años de uso.
    index('idx_eventos_publicados')
      .on(t.iglesiaId, t.inicioEn)
      .where(sql`${t.publicado}`),
  ],
);

/**
 * Quién se ha apuntado.
 *
 * SE APUNTA CUALQUIERA, SIN CUENTA Y SIN MEMBRESÍA
 * ------------------------------------------------
 * No hay `auth_user_id` ni `miembro_id`. Es deliberado: el caso normal es el
 * vecino que vio el cartel. Cruzar la inscripción con la ficha de miembro cuando
 * el correo coincide sería construir el mapa persona→acto religioso que este
 * módulo evita tener, y por el mismo motivo por el que `movimientos` no guarda
 * el nombre del donante.
 *
 * LA IDENTIDAD ES EL CORREO, EN MINÚSCULAS
 * ----------------------------------------
 * `uq_inscripcion_viva_por_email` es PARCIAL —solo sobre las vivas— para que
 * quien cancela pueda volver a apuntarse, y va sobre `lower(email)` en vez de
 * sobre la columna para que no dependa de que todo el que escriba se acuerde de
 * normalizar. El CHECK `email = lower(email)` lo hace explícito además.
 */
export const eventoInscripciones = pgTable(
  'evento_inscripciones',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    /**
     * Redundante respecto a `eventos.iglesia_id`, y a propósito: es la
     * convención del repo. Con la columna, cada policy es una comparación
     * directa; sin ella, una subconsulta encadenada con un índice por salto. El
     * precio es que puede mentir, y eso lo impide HT113.
     */
    iglesiaId: uuid('iglesia_id')
      .notNull()
      .references(() => iglesias.id, { onDelete: 'cascade' }),

    eventoId: uuid('evento_id')
      .notNull()
      .references(() => eventos.id, { onDelete: 'cascade' }),

    origen: origenInscripcionEnum('origen').notNull().default('publico'),

    nombre: text('nombre').notNull(),
    email: text('email').notNull(),
    telefono: text('telefono'),

    /** Cuántos vienen ADEMÁS de quien se apunta. Tope duro de diez en el CHECK. */
    acompanantes: integer('acompanantes').notNull().default(0),

    /**
     * Texto libre de un desconocido. Es la superficie más expuesta del módulo:
     * escritura pública, sin cuenta, en la tabla de una congregación concreta.
     * Tope de 500 aquí Y en la función, porque `text` en Postgres llega a 1 GB.
     */
    nota: text('nota'),

    /**
     * Lo marca el organizador a mano. NO es un hecho verificado por Hatril, y
     * así se dice en `/terminos`.
     */
    pagado: boolean('pagado').notNull().default(false),
    pagadoAt: timestamp('pagado_at', { withTimezone: true }),

    /** Quién lo marcó. Uuid pelado, coherencia por HT113. */
    marcadoPorMiembroId: uuid('marcado_por_miembro_id'),

    /**
     * El secreto que sustituye a la cuenta.
     *
     * `gen_random_uuid()` sin guiones, generado DENTRO de la función. Nunca
     * `substr(md5(random()::text), 1, 8)`: el `random()` de Postgres no es un
     * generador criptográfico —estado de 48 bits, sembrado por backend, y con
     * pooler de sesión ese backend sirve muchas peticiones—, así que ocho
     * caracteres hexadecimales tendrían los bits que le queden al estado
     * observable, no 32.
     *
     * Y no se puede usar `gen_random_bytes()`: pgcrypto vive en el esquema
     * `extensions`, así que con `search_path = public, pg_temp` la llamada sin
     * cualificar falla con «function does not exist». Comprobado contra la base.
     * `gen_random_uuid()` sí resuelve, porque está en `pg_catalog`.
     *
     * NO SALE NUNCA EN UN VALOR DE RETORNO: viaja por correo y en ningún otro
     * sitio. El porqué, en la cabecera de la `0023`.
     */
    codigoCancelacion: text('codigo_cancelacion').notNull(),

    canceladaAt: timestamp('cancelada_at', { withTimezone: true }),

    /**
     * Versión del texto de privacidad que la persona aceptó. NOT NULL.
     *
     * Es la prueba del art. 7.1 y el motivo de que la columna exista. La
     * resuelve la aplicación desde `VERSION_POLITICA_PRIVACIDAD` y la función la
     * valida contra `^privacidad-[0-9]{4}-[0-9]{2}$`: no puede ser NULL, no
     * puede ser basura y no puede ser de 100 MB.
     *
     * NO va a `public.consentimientos` porque esa tabla tiene `miembro_id` NOT
     * NULL y aquí no hay miembro. La consecuencia buena es que este
     * consentimiento es INDEPENDIENTE del de la congregación: subir la versión
     * por un evento no obliga a re-preguntar a toda la iglesia.
     */
    consentimientoVersion: text('consentimiento_version').notNull(),
    consentimientoAt: timestamp('consentimiento_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /**
     * ¿Quiere recibir avisos de esta iglesia? En la v1 vale SIEMPRE false y el
     * formulario no enseña la casilla.
     *
     * Sin verificación de correo, un booleano del cliente permite inscribir a un
     * tercero Y afirmar que consintió recibir comunicaciones religiosas de una
     * congregación: se fabricaría un registro que dice algo del art. 9 sobre
     * alguien que nunca lo dijo. La columna existe para el día que haya doble
     * confirmación por correo; hasta entonces no la escribe nadie.
     */
    consentimientoAvisos: boolean('consentimiento_avisos')
      .notNull()
      .default(false),

    /**
     * Evidencia técnica del consentimiento (art. 7.1). Se GUARDA, no se usa para
     * limitar el ritmo: la IP sale del primer salto de `x-forwarded-for` y es
     * falsificable. Como prueba acompañada de fecha y versión vale; como clave
     * de un contador, la elige el atacante.
     */
    ip: inet('ip'),
    userAgent: text('user_agent'),

    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    /*
     * Topes de longitud EN LA BASE, además de en la función.
     *
     * La función es la que da un mensaje decente; estos son los que garantizan
     * el invariante. Es la regla del proyecto aplicada a un caso donde de verdad
     * importa: escritura pública sin autenticar en una tabla con nombres y
     * correos de personas.
     */
    check(
      'ck_inscripciones_nombre_len',
      sql`length(${t.nombre}) between 1 and 120`,
    ),
    check(
      'ck_inscripciones_email_len',
      sql`length(${t.email}) between 3 and 200`,
    ),
    check(
      'ck_inscripciones_email_minusculas',
      sql`${t.email} = lower(${t.email})`,
    ),
    check(
      'ck_inscripciones_telefono_len',
      sql`${t.telefono} is null or length(${t.telefono}) <= 32`,
    ),
    check(
      'ck_inscripciones_nota_len',
      sql`${t.nota} is null or length(${t.nota}) <= 500`,
    ),
    check(
      'ck_inscripciones_user_agent_len',
      sql`${t.userAgent} is null or length(${t.userAgent}) <= 400`,
    ),
    check(
      'ck_inscripciones_consentimiento_len',
      sql`length(${t.consentimientoVersion}) between 5 and 40`,
    ),
    check(
      'ck_inscripciones_codigo_len',
      sql`length(${t.codigoCancelacion}) between 20 and 64`,
    ),
    check(
      'ck_inscripciones_acompanantes',
      sql`${t.acompanantes} between 0 and 10`,
    ),

    // Una equivalencia, no dos condiciones sueltas — mismo patrón que
    // `ck_movimientos_tipo_ingreso`. Escrito por separado, el caso inverso
    // (`pagado_at` relleno con `pagado` en false) se cuela.
    check(
      'ck_inscripciones_pagado',
      sql`${t.pagado} = (${t.pagadoAt} is not null)`,
    ),

    // Una inscripción hecha desde el panel NO puede llevar evidencia técnica: la
    // IP sería la del pastor. Guardarla como si fuera la del inscrito es
    // fabricar una prueba falsa.
    check(
      'ck_inscripciones_origen_evidencia',
      sql`${t.origen} = 'publico' or (${t.ip} is null and ${t.userAgent} is null)`,
    ),

    // La identidad viva. Parcial: quien cancela puede volver a apuntarse.
    uniqueIndex('uq_inscripcion_viva_por_email')
      .on(t.eventoId, sql`lower(${t.email})`)
      .where(sql`${t.canceladaAt} is null`),

    uniqueIndex('uq_inscripcion_codigo').on(t.codigoCancelacion),

    // El aforo, que se cuenta bajo cerrojo en cada alta.
    index('idx_inscripciones_evento_vivas')
      .on(t.eventoId)
      .where(sql`${t.canceladaAt} is null`),

    // La lista del panel y la exportación a CSV.
    index('idx_inscripciones_iglesia').on(t.iglesiaId, t.createdAt.desc()),
  ],
);
