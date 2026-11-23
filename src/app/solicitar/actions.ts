'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dbAdmin } from '@/lib/db';
import {
  iglesiaUsuarios,
  solicitudesIngreso,
  solicitudInvitaciones,
  iglesias,
} from '@/lib/db/schema';
import { esGuardHatril, isUniqueViolation } from '@/lib/db/error';
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
import { grupoDeLaInvitacion, solicitudPendienteEn } from '@/lib/grupos/invitacion';
import { leerCodigo } from '@/lib/grupos/codigo';

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
 */

/**
 * Con el `next` detrás cuando lo hay: un error al crear la cuenta no debe
 * hacer perder la iglesia a la que se iba. Pasa por `destinoSeguro` porque
 * vuelve a la URL y de ahí al campo oculto del formulario.
 */
function volverCon(ruta: string, error: string, next?: string): never {
  const destino = destinoSeguro(next);
  const extra = destino ? `&next=${encodeURIComponent(destino)}` : '';
  // `&` si la ruta ya trae su consulta: la de una invitación lleva `?grupo=`, y
  // con un segundo `?` el error se pegaba al código —«?grupo=X?error=…»—, el
  // código dejaba de leerse y la persona perdía el mensaje y la célula.
  const separador = ruta.includes('?') ? '&' : '?';
  redirect(`${ruta}${separador}error=${encodeURIComponent(error)}${extra}`);
}

const EsquemaSolicitud = z.object({
  slug: z.string().trim().min(1),
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  telefono: z.string().trim().max(40).optional().or(z.literal('')),
  mensaje: z.string().trim().max(600).optional().or(z.literal('')),
  consentimiento: z.literal(true, {
    message: 'Tienes que aceptar para poder enviar la solicitud.',
  }),
  // Opcional de verdad: sin marcar también se puede entrar. Por eso es un
  // booleano y no un `literal(true)` como la de arriba.
  asistencia: z.boolean(),
});

export async function solicitarIngreso(formData: FormData) {
  const parsed = EsquemaSolicitud.safeParse({
    slug: campoObligatorio(formData, 'slug'),
    nombre: campoObligatorio(formData, 'nombre'),
    telefono: campo(formData, 'telefono'),
    mensaje: campo(formData, 'mensaje'),
    consentimiento: casilla(formData, 'consentimiento'),
    asistencia: casilla(formData, 'asistencia'),
  });

  const slug = String(formData.get('slug') ?? '');
  // El código de la célula que invita, si lo hay. Se vuelve a resolver aquí y
  // no se fía del formulario: un id de grupo en un campo oculto se cambia a
  // mano, un código que no casa con esta iglesia no encuentra nada.
  const codigo = leerCodigo(campo(formData, 'grupo'));
  const volverA = `/solicitar/${slug}${codigo ? `?grupo=${codigo}` : ''}`;

  if (!parsed.success) {
    volverCon(volverA, parsed.error.issues[0]!.message);
  }

  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(volverA)}`);
  }

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
    volverCon('/iglesias', 'No encontramos esa iglesia.');
  }

  if (!iglesia.aceptaSolicitudes) {
    volverCon(
      volverA,
      'Esta iglesia no está aceptando solicitudes ahora mismo. Ponte en contacto con ellos directamente.',
    );
  }

  const grupo = await grupoDeLaInvitacion(iglesia.id, codigo);

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
          // Con el país de la iglesia, no 'CO' fijo: un «612 345 678» de
          // Tenerife no encaja en la regla colombiana, se guardaba sin +34 y
          // la ficha aprobada se quedaba sin botón de WhatsApp.
          telefono: normalizarTelefono(d.telefono || null, iglesia.pais),
          mensaje: d.mensaje || null,
          // Las dos, siempre. NULL en cualquiera significa «no consta» y aprobar
          // lo trata como tal: ver las columnas en el schema.
          aceptaAsistencia: d.asistencia,
          versionTexto: VERSION_POLITICA_PRIVACIDAD,
        })
        .returning({ id: solicitudesIngreso.id });

      solicitudId = creada!.id;

      // La invitación, en su tabla y con el código con que llegó: la lee solo
      // el pastor y se borra al resolver la solicitud (`0049`).
      if (grupo) {
        await tx.insert(solicitudInvitaciones).values({
          solicitudId: creada!.id,
          iglesiaId: iglesia.id,
          grupoId: grupo.id,
          codigo: grupo.codigo,
        });
      }

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

const EsquemaSumarInvitacion = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  grupo: z.string().optional(),
});

/**
 * Quien ya había pedido entrar sin enlace abre el de una célula: que su
 * solicitud pendiente lleve también esa invitación.
 *
 * Sin esto, el enlace no le hacía nada —`/solicitar` le mandaba a `/mi`— y la
 * célula que le invitó se perdía sin que nadie lo supiera. Solo para una
 * solicitud PENDIENTE de ESTA iglesia y de ESTA cuenta, sin invitación ya, y
 * con un código que valga hoy: lo vuelve a resolver todo aquí, no se fía del
 * formulario. Por `dbAdmin`, como el resto de `/solicitar`: mientras espera,
 * la cuenta no ve nada de la iglesia.
 */
export async function sumarInvitacionASolicitud(formData: FormData) {
  const parsed = EsquemaSumarInvitacion.safeParse({
    slug: campoObligatorio(formData, 'slug'),
    grupo: campo(formData, 'grupo'),
  });
  // Sin mensaje: el formulario lo pinta la página con los dos campos ocultos, y
  // si no llegan bien es que se ha fabricado a mano.
  const codigo = parsed.success ? leerCodigo(parsed.data.grupo) : null;
  if (!parsed.success || !codigo) redirect('/mi');
  const { slug } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(`/solicitar/${slug}?grupo=${codigo}`)}`);
  }

  const [iglesia] = await dbAdmin
    .select({ id: iglesias.id })
    .from(iglesias)
    .where(and(eq(iglesias.slug, slug), eq(iglesias.activa, true)))
    .limit(1);
  if (!iglesia) redirect('/mi');

  const [grupo, solicitud] = await Promise.all([
    grupoDeLaInvitacion(iglesia.id, codigo),
    solicitudPendienteEn(user.id, iglesia.id),
  ]);
  if (!grupo || !solicitud || solicitud.conInvitacion) redirect('/mi');

  // Dos pestañas a la vez: la segunda choca con la clave primaria y no pasa
  // nada, la invitación ya está.
  try {
    await dbAdmin
      .insert(solicitudInvitaciones)
      .values({
        solicitudId: solicitud.id,
        iglesiaId: iglesia.id,
        grupoId: grupo.id,
        codigo: grupo.codigo,
      })
      .onConflictDoNothing();
  } catch (err) {
    // Se aprobó o se rechazó entre la lectura de arriba y aquí: la base ya no
    // la deja colgar de una solicitud resuelta (HT132, `0050`). No queda nada a
    // lo que sumarla, y `/mi` dice cómo quedó.
    if (esGuardHatril(err, 'HT132')) redirect('/mi');
    throw err;
  }

  redirect('/mi?invitacion=1');
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
