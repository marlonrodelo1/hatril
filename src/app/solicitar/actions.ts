'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { dbAdmin } from '@/lib/db';
import { iglesiaUsuarios, solicitudesIngreso, iglesias } from '@/lib/db/schema';
import { isUniqueViolation } from '@/lib/db/error';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { validarPassword, traducirErrorAuth } from '@/lib/auth/password';
import { normalizarTelefono } from '@/lib/telefono/normalizar';

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

function volverCon(ruta: string, error: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(error)}`);
}

const EsquemaSolicitud = z.object({
  slug: z.string().trim().min(1),
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  telefono: z.string().trim().max(40).optional().or(z.literal('')),
  mensaje: z.string().trim().max(600).optional().or(z.literal('')),
  consentimiento: z.literal('on', {
    message: 'Tienes que aceptar para poder enviar la solicitud.',
  }),
});

export async function solicitarIngreso(formData: FormData) {
  const parsed = EsquemaSolicitud.safeParse({
    slug: formData.get('slug'),
    nombre: formData.get('nombre'),
    telefono: formData.get('telefono'),
    mensaje: formData.get('mensaje'),
    consentimiento: formData.get('consentimiento'),
  });

  const slug = String(formData.get('slug') ?? '');

  if (!parsed.success) {
    volverCon(`/solicitar/${slug}`, parsed.error.issues[0]!.message);
  }

  const d = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(`/solicitar/${d.slug}`)}`);
  }

  const [iglesia] = await dbAdmin
    .select({
      id: iglesias.id,
      nombre: iglesias.nombre,
      aceptaSolicitudes: iglesias.aceptaSolicitudes,
    })
    .from(iglesias)
    .where(and(eq(iglesias.slug, d.slug), eq(iglesias.activa, true)))
    .limit(1);

  if (!iglesia) {
    volverCon('/iglesias', 'No encontramos esa iglesia.');
  }

  if (!iglesia.aceptaSolicitudes) {
    volverCon(
      `/solicitar/${d.slug}`,
      'Esta iglesia no está aceptando solicitudes ahora mismo. Ponte en contacto con ellos directamente.',
    );
  }

  try {
    await dbAdmin.transaction(async (tx) => {
      await tx.insert(solicitudesIngreso).values({
        iglesiaId: iglesia.id,
        authUserId: user.id,
        nombre: d.nombre,
        email: user.email ?? null,
        telefono: normalizarTelefono(d.telefono || null, 'CO'),
        mensaje: d.mensaje || null,
      });

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

  redirect('/mi?enviada=1');
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
    nombre: formData.get('nombre'),
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next'),
  });

  if (!parsed.success) {
    volverCon('/crear-cuenta', parsed.error.issues[0]!.message);
  }

  const { nombre, email, password, next } = parsed.data;

  const errorPassword = validarPassword(password);
  if (errorPassword) volverCon('/crear-cuenta', errorPassword);

  const cabeceras = await headers();
  const ip = getClientIp(new Request('https://hatril', { headers: cabeceras }));
  const limite = await checkRateLimit('ip', `cuenta:${ip}`, 10);

  if (!limite.ok) {
    volverCon(
      '/crear-cuenta',
      'Se han creado demasiadas cuentas desde esta conexión hoy. Inténtalo mañana.',
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
    volverCon('/crear-cuenta', traducirErrorAuth(errorAuth?.message ?? ''));
  }

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (errorSesion) {
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.');
  }

  // Aquí no hay nada que deshacer si algo falla después: a diferencia del alta
  // de iglesia, esta cuenta suelta es útil por sí misma.
  const destino =
    next && next.startsWith('/') && !next.startsWith('//') ? next : '/mi';

  redirect(destino);
}
