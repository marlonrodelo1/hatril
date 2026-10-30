'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq, inArray } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dbAdmin } from '@/lib/db';
import { iglesiaUsuarios, solicitudesIngreso, iglesias } from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { validarPassword, traducirErrorAuth } from '@/lib/auth/password';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import { campo, campoObligatorio, casilla } from '@/lib/api/formulario';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import {
  cuentasQueAprueban,
  emitirNotificaciones,
} from '@/lib/notificaciones/emitir';

/**
 * Crear cuenta personal y pedir entrar en una iglesia.
 *
 * DOS ALTAS DISTINTAS QUE NO HAY QUE MEZCLAR
 * ------------------------------------------
 * `/registro` crea una IGLESIA: quien lo usa es el pastor y acaba de `pastor`
 * con la membresía ya activa. Esto de aquí crea una CUENTA PERSONAL, sin
 * iglesia, para quien quiere unirse a una que ya existe.
 *
 * Si fueran el mismo formulario, cada miembro de una congregación acabaría
 * fundando su propia iglesia vacía al intentar unirse a la suya.
 *
 * `dbAdmin` en todo el fichero, y por el mismo motivo que en el alta de
 * iglesia: quien solicita no pertenece a ninguna todavía, así que las policies
 * de `hatril_app` no le dejan ver ni la iglesia a la que quiere entrar. La
 * comprobación de que la iglesia acepta solicitudes se hace aquí a mano,
 * duplicando la que ya está en la policy de INSERT.
 *
 * LA CUENTA SE PIDE AL FINAL, Y EN EL MISMO FORMULARIO
 * ---------------------------------------------------
 * Desde la bienvenida de la app (30-oct), quien no tiene cuenta la crea en la
 * propia solicitud: `crearCuentaYSolicitar`. Antes eran dos pantallas —crear la
 * cuenta y volver a la solicitud—, y en la segunda se perdía gente. La de
 * `crearCuentaPersonal` sigue para `/crear-cuenta`.
 */

/**
 * Con el `next` detrás cuando lo hay: un error al crear la cuenta no debe
 * hacer perder la iglesia a la que se iba. Pasa por `destinoSeguro` porque
 * vuelve a la URL y de ahí al campo oculto del formulario.
 */
function volverCon(ruta: string, error: string, next?: string): never {
  const destino = destinoSeguro(next);
  const extra = destino ? `&next=${encodeURIComponent(destino)}` : '';
  redirect(`${ruta}?error=${encodeURIComponent(error)}${extra}`);
}

const CamposSolicitud = {
  slug: z.string().trim().min(1),
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  // Obligatorio desde el 30-oct, decidido por Marlon: es como la iglesia
  // contacta a quien acaba de llegar, y una ficha sin teléfono no se puede
  // acompañar.
  telefono: z
    .string()
    .trim()
    .min(6, 'Escribe tu teléfono: es como la iglesia podrá contactarte.')
    .max(40),
  prefijo: z.enum(['ES', 'CO']).optional(),
  direccion: z.string().trim().max(240).optional().or(z.literal('')),
  mensaje: z.string().trim().max(600).optional().or(z.literal('')),
  consentimiento: z.literal(true, {
    message: 'Tienes que aceptar para poder enviar la solicitud.',
  }),
  // Opcional de verdad: sin marcar también se puede entrar. Por eso es un
  // booleano y no un `literal(true)` como la de arriba.
  asistencia: z.boolean(),
};

const EsquemaSolicitud = z.object(CamposSolicitud);

type DatosSolicitud = z.infer<typeof EsquemaSolicitud>;

function leerSolicitud(formData: FormData) {
  return {
    slug: campoObligatorio(formData, 'slug'),
    nombre: campoObligatorio(formData, 'nombre'),
    telefono: campoObligatorio(formData, 'telefono'),
    prefijo: campo(formData, 'prefijo'),
    direccion: campo(formData, 'direccion'),
    mensaje: campo(formData, 'mensaje'),
    consentimiento: casilla(formData, 'consentimiento'),
    asistencia: casilla(formData, 'asistencia'),
  };
}

export async function solicitarIngreso(formData: FormData) {
  const parsed = EsquemaSolicitud.safeParse(leerSolicitud(formData));
  const slug = String(formData.get('slug') ?? '');

  if (!parsed.success) {
    volverCon(`/solicitar/${slug}`, parsed.error.issues[0]!.message);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(`/solicitar/${parsed.data.slug}`)}`);
  }

  await registrarSolicitud(user, parsed.data);
}

const EsquemaCuentaYSolicitud = z.object({
  ...CamposSolicitud,
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string(),
});

/**
 * Crear la cuenta y pedir entrar, de una vez.
 *
 * El orden importa: primero se valida TODO —también lo de la solicitud—, y solo
 * entonces se crea la cuenta. Al revés, un teléfono vacío dejaría creada una
 * cuenta sin solicitud, y la persona volvería al formulario con un correo que
 * ya «tiene cuenta» sin haber terminado nada.
 */
export async function crearCuentaYSolicitar(formData: FormData) {
  const slug = String(formData.get('slug') ?? '');
  // Con el tipo escrito delante: sin él, TypeScript no entiende que tras
  // `volver()` no se sigue, y no estrecha lo que viene después.
  const volver: (error: string) => never = (error) =>
    volverCon(`/solicitar/${slug}`, error);

  const parsed = EsquemaCuentaYSolicitud.safeParse({
    ...leerSolicitud(formData),
    email: campoObligatorio(formData, 'email'),
    // Sin `campo()`: recorta espacios, y en una contraseña un espacio es un
    // carácter más.
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  const { email, password, ...solicitud } = parsed.data;

  const errorPassword = validarPassword(password);
  if (errorPassword) volver(errorPassword);

  const cabeceras = await headers();
  const ip = getClientIp(new Request('https://hatril', { headers: cabeceras }));
  const limite = await checkRateLimit('ip', `cuenta:${ip}`, 10);
  if (!limite.ok) {
    volver('Se han creado demasiadas cuentas desde esta conexión hoy. Inténtalo mañana.');
  }

  const admin = createAdminClient();
  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: solicitud.nombre },
  });

  if (errorAuth || !creado.user) {
    const m = errorAuth?.message ?? '';
    volver(
      /already|registered|exists/i.test(m)
        ? 'Este correo ya tiene cuenta. Entra con él y vuelves aquí con la solicitud.'
        : traducirErrorAuth(m),
    );
  }

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (errorSesion) {
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.', `/solicitar/${slug}`);
  }

  await registrarSolicitud(creado.user, solicitud);
}

/** La solicitud y la membresía pendiente, comunes a las dos entradas. */
async function registrarSolicitud(user: User, d: DatosSolicitud): Promise<never> {
  const [iglesia] = await dbAdmin
    .select({
      id: iglesias.id,
      nombre: iglesias.nombre,
      aceptaSolicitudes: iglesias.aceptaSolicitudes,
      pais: iglesias.pais,
    })
    .from(iglesias)
    .where(and(eq(iglesias.slug, d.slug), eq(iglesias.activa, true)))
    .limit(1);

  if (!iglesia) {
    volverCon('/buscar', 'No encontramos esa iglesia.');
  }

  if (!iglesia.aceptaSolicitudes) {
    volverCon(
      `/solicitar/${d.slug}`,
      'Esta iglesia no está aceptando solicitudes ahora mismo. Ponte en contacto con ellos directamente.',
    );
  }

  // Una sola iglesia por persona (decidido el 30-oct). La base admitiría dos —
  // el unique es por pareja—, así que lo dice la aplicación: con una membresía
  // activa o pendiente en otra, no se pide entrar en esta.
  const [otra] = await dbAdmin
    .select({ id: iglesiaUsuarios.id })
    .from(iglesiaUsuarios)
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, user.id),
        // Una baja no cuenta: a quien su iglesia dio de baja no se le cierra
        // la puerta de otra.
        inArray(iglesiaUsuarios.estado, ['activo', 'pendiente']),
      ),
    )
    .limit(1);
  if (otra) redirect('/mi');

  let solicitudId: string | null = null;

  try {
    await dbAdmin.transaction(async (tx) => {
      const [creada] = await tx
        .insert(solicitudesIngreso)
        .values({
          iglesiaId: iglesia.id,
          authUserId: user.id,
          nombre: d.nombre,
          email: user.email ?? null,
          // Con el prefijo elegido y, si no, con el país de la iglesia: un «612
          // 345 678» de Tenerife no encaja en la regla colombiana, se guardaba
          // sin +34 y la ficha aprobada se quedaba sin botón de WhatsApp.
          telefono: normalizarTelefono(d.telefono, d.prefijo ?? iglesia.pais),
          direccion: d.direccion || null,
          mensaje: d.mensaje || null,
          // Las dos, siempre. NULL en cualquiera significa «no consta» y aprobar
          // lo trata como tal: ver las columnas en el schema.
          aceptaAsistencia: d.asistencia,
          versionTexto: VERSION_POLITICA_PRIVACIDAD,
        })
        .returning({ id: solicitudesIngreso.id });

      solicitudId = creada!.id;

      /*
       * La membresía se crea YA, en estado 'pendiente'.
       *
       * Podría crearse solo al aprobar, pero entonces habría dos sitios
       * distintos donde vive «esta persona tiene algo que ver con esta
       * iglesia», y aprobar tendría que crear la fila desde cero. Con la fila
       * puesta desde el principio, aprobar es cambiar un estado.
       *
       * Y no abre nada: `pertenece_a_iglesia()` exige `estado = 'activo'`, así
       * que mientras esté pendiente esta persona no ve absolutamente nada de la
       * congregación. Es el requisito del art. 9, y está en la base de datos y
       * no en la aplicación.
       */
      await tx.insert(iglesiaUsuarios).values({
        iglesiaId: iglesia.id,
        authUserId: user.id,
        rol: 'miembro',
        estado: 'pendiente',
      });
    });
  } catch (err) {
    // Choca contra `uq_solicitudes_pendiente_por_persona` o contra el unique
    // de membresía: ya hay una solicitud viva, o ya pertenece a esa iglesia.
    if (isUniqueViolation(err)) {
      redirect('/mi');
    }
    throw err;
  }

  /*
   * El aviso, DESPUÉS del `try` y nunca dentro.
   *
   * Dentro habría avisado también cuando la transacción se cae por duplicado
   * —alguien que pulsa dos veces, o que ya había solicitado— y el equipo
   * recibiría un aviso de una solicitud que no llegó a existir.
   *
   * Y va a todo el que pueda aprobarlas, no solo al pastor: en una iglesia con
   * secretaria es ella quien mira esta bandeja.
   */
  const destinatarios = await cuentasQueAprueban(iglesia.id);

  await emitirNotificaciones(
    destinatarios.map((destinatario) => ({
      iglesiaId: iglesia.id,
      destinatarioAuthUserId: destinatario,
      tipo: 'solicitud_recibida' as const,
      datos: {
        quien: d.nombre,
        ...(solicitudId ? { solicitudId } : {}),
        ...(d.mensaje ? { mensaje: d.mensaje } : {}),
      },
      enlace: '/panel/solicitudes',
    })),
  );

  redirect('/mi?enviada=1');
}

/**
 * Cancelar la solicitud propia mientras está pendiente.
 *
 * Se borran la solicitud y la membresía pendiente, las dos o ninguna. Por
 * `dbAdmin` como el resto del fichero: quien la cancela no pertenece a la
 * iglesia. Solo lo suyo y solo lo pendiente: el `where` lleva la cuenta de la
 * sesión, no un id que llegue del formulario.
 */
export async function cancelarSolicitud() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso');

  await dbAdmin.transaction(async (tx) => {
    await tx
      .delete(solicitudesIngreso)
      .where(
        and(
          eq(solicitudesIngreso.authUserId, user.id),
          eq(solicitudesIngreso.estado, 'pendiente'),
        ),
      );
    await tx
      .delete(iglesiaUsuarios)
      .where(
        and(
          eq(iglesiaUsuarios.authUserId, user.id),
          eq(iglesiaUsuarios.estado, 'pendiente'),
        ),
      );
  });

  redirect('/mi?cancelada=1');
}

// ============================================================================
// Cuenta personal, sin iglesia
// ============================================================================

const EsquemaCuenta = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string(),
  next: z.string().optional(),
});

export async function crearCuentaPersonal(formData: FormData) {
  const parsed = EsquemaCuenta.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    email: campoObligatorio(formData, 'email'),
    password: String(formData.get('password') ?? ''),
    next: campo(formData, 'next'),
  });

  if (!parsed.success) {
    volverCon(
      '/crear-cuenta',
      parsed.error.issues[0]!.message,
      campo(formData, 'next'),
    );
  }

  const { nombre, email, password, next } = parsed.data;

  const errorPassword = validarPassword(password);
  if (errorPassword) volverCon('/crear-cuenta', errorPassword, next);

  const cabeceras = await headers();
  const ip = getClientIp(new Request('https://hatril', { headers: cabeceras }));
  const limite = await checkRateLimit('ip', `cuenta:${ip}`, 10);

  if (!limite.ok) {
    volverCon(
      '/crear-cuenta',
      'Se han creado demasiadas cuentas desde esta conexión hoy. Inténtalo mañana.',
      next,
    );
  }

  const admin = createAdminClient();

  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre },
  });

  if (errorAuth || !creado.user) {
    volverCon(
      '/crear-cuenta',
      traducirErrorAuth(errorAuth?.message ?? ''),
      next,
    );
  }

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (errorSesion) {
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.', next);
  }

  // Aquí no hay nada que deshacer si algo falla después: a diferencia del alta
  // de iglesia, esta cuenta suelta es útil por sí misma.
  const destino = destinoSeguro(next) ?? '/mi';

  redirect(destino);
}
