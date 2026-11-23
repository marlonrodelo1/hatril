import 'server-only';

import { and, eq, inArray } from 'drizzle-orm';
import type { User } from '@supabase/supabase-js';

import { createAdminClient } from '@/lib/supabase/admin';
import { dbAdmin } from '@/lib/db';
import {
  iglesiaUsuarios,
  solicitudesIngreso,
  solicitudInvitaciones,
  iglesias,
} from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { validarPassword, traducirErrorAuth } from '@/lib/auth/password';
import { normalizarTelefono } from '@/lib/telefono/normalizar';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { cuentasQueAprueban, emitirNotificaciones } from '@/lib/notificaciones/emitir';
import { leerCodigo } from '@/lib/grupos/codigo';
import { grupoDeLaInvitacion } from '@/lib/grupos/invitacion';
import type { DatosCuentaPersonal, DatosSolicitud } from '@/lib/app-api/solicitud';

/**
 * Crear cuenta personal, pedir entrar en una iglesia y cancelarlo.
 *
 * Vivía entero en `src/app/solicitar/actions.ts`, con `redirect()` en cada
 * salida. Bajó aquí el 20-nov para que la app empaquetada lo use sin copiarlo
 * (`docs/app-nativa/plan-spa.md` §2): las actions de la web y los endpoints de
 * `/api/v1/app` llaman a estas funciones, y cada uno convierte el resultado a
 * lo suyo —una redirección o un JSON—. La lógica y sus porqués no han cambiado.
 *
 * `dbAdmin` en todo el fichero, y por el mismo motivo que en el alta de
 * iglesia: quien solicita no pertenece a ninguna todavía, así que las policies
 * de `hatril_app` no le dejan ver ni la iglesia a la que quiere entrar. La
 * comprobación de que la iglesia acepta solicitudes se hace aquí a mano,
 * duplicando la que ya está en la policy de INSERT.
 */

export type ResultadoCuenta =
  | { ok: true; user: User }
  | { ok: false; error: string; yaExiste: boolean };

/**
 * La cuenta personal, ya confirmada y sin iglesia. Quien la llama abre después
 * la sesión: la web con su cookie, la app en el teléfono.
 *
 * Se crea confirmada, sin correo de verificación, por lo mismo que el alta de
 * iglesia (`registrar` en `(auth)/actions.ts`): el riesgo es que el dueño de
 * un correo no pueda registrarse después, no que nadie lea datos ajenos.
 */
export async function crearCuentaPersonal(
  datos: DatosCuentaPersonal,
  ip: string,
): Promise<ResultadoCuenta> {
  const errorPassword = validarPassword(datos.password);
  if (errorPassword) return { ok: false, error: errorPassword, yaExiste: false };

  const limite = await checkRateLimit('ip', `cuenta:${ip}`, 10);
  if (!limite.ok) {
    return {
      ok: false,
      error: 'Se han creado demasiadas cuentas desde esta conexión hoy. Inténtalo mañana.',
      yaExiste: false,
    };
  }

  const { data: creado, error } = await createAdminClient().auth.admin.createUser({
    email: datos.email,
    password: datos.password,
    email_confirm: true,
    user_metadata: { nombre: datos.nombre },
  });

  if (error || !creado.user) {
    const m = error?.message ?? '';
    return { ok: false, error: traducirErrorAuth(m), yaExiste: /already|registered|exists/i.test(m) };
  }
  return { ok: true, user: creado.user };
}

/** `/solicitar/<slug>`, con `?grupo=` si se llegó con la invitación de una célula. */
export function rutaDeSolicitud(slug: string, codigo: string | null): string {
  return `/solicitar/${slug}${codigo ? `?grupo=${codigo}` : ''}`;
}

export type ResultadoSolicitud =
  | { ok: true; resultado: 'enviada' | 'ya_tenia' }
  | { ok: false; error: string; ir: string };

/**
 * La solicitud y la membresía pendiente.
 *
 * `ya_tenia`: ya pertenece a una iglesia o tiene otra solicitud. Una sola
 * iglesia por persona (ESTADO.md, «La bienvenida de la app»).
 */
export async function registrarSolicitud(
  user: User,
  d: DatosSolicitud,
): Promise<ResultadoSolicitud> {
  // El código de la célula que invita viaja en la vuelta: perderlo con un error
  // era perder la célula sin que la persona lo supiera.
  const codigo = leerCodigo(d.grupo);
  const volverA = rutaDeSolicitud(d.slug, codigo);

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

  if (!iglesia) return { ok: false, error: 'No encontramos esa iglesia.', ir: '/buscar' };

  if (!iglesia.aceptaSolicitudes) {
    return {
      ok: false,
      error:
        'Esta iglesia no está aceptando solicitudes ahora mismo. Ponte en contacto con ellos directamente.',
      ir: volverA,
    };
  }

  // Una sola iglesia por persona: con una membresía activa o pendiente no se
  // pide otra. La base lo admitiría (el unique es por pareja).
  const [otra] = await dbAdmin
    .select({ id: iglesiaUsuarios.id })
    .from(iglesiaUsuarios)
    .where(
      and(
        eq(iglesiaUsuarios.authUserId, user.id),
        inArray(iglesiaUsuarios.estado, ['activo', 'pendiente']),
      ),
    )
    .limit(1);
  if (otra) return { ok: true, resultado: 'ya_tenia' };

  // Se vuelve a resolver aquí y no se fía del formulario: un código que no
  // casa con esta iglesia, de un grupo cerrado o de una red sin la herramienta,
  // no encuentra nada, y la solicitud sigue sin invitación.
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
          telefono: normalizarTelefono(d.telefono, d.prefijo ?? iglesia.pais),
          direccion: d.direccion || null,
          mensaje: d.mensaje || null,
          aceptaAsistencia: d.asistencia,
          versionTexto: VERSION_POLITICA_PRIVACIDAD,
        })
        .returning({ id: solicitudesIngreso.id });

      solicitudId = creada!.id;

      // La invitación, en su tabla y con el código con que llegó: la lee solo
      // el pastor y se borra al resolver la solicitud (`0048`, `0049`).
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
    if (isUniqueViolation(err)) return { ok: true, resultado: 'ya_tenia' };
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

  return { ok: true, resultado: 'enviada' };
}

/**
 * Cancelar la solicitud propia mientras está pendiente.
 *
 * Se borran la solicitud y la membresía pendiente, las dos o ninguna. Solo lo
 * suyo y solo lo pendiente: el `where` lleva la cuenta de la sesión, no un id
 * que llegue de fuera.
 */
export async function cancelarSolicitudDe(authUserId: string): Promise<void> {
  await dbAdmin.transaction(async (tx) => {
    await tx
      .delete(solicitudesIngreso)
      .where(
        and(eq(solicitudesIngreso.authUserId, authUserId), eq(solicitudesIngreso.estado, 'pendiente')),
      );
    await tx
      .delete(iglesiaUsuarios)
      .where(and(eq(iglesiaUsuarios.authUserId, authUserId), eq(iglesiaUsuarios.estado, 'pendiente')));
  });
}
