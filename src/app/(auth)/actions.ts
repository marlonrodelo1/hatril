'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { crearIglesiaConSeeds } from '@/lib/onboarding/crear-iglesia';
import { checkRateLimit, getClientIp } from '@/lib/api/rate-limit';
import { validarPassword, traducirErrorAuth } from '@/lib/auth/password';
import { getOrigin } from '@/lib/auth/get-origin';
import { campo, campoObligatorio } from '@/lib/api/formulario';

/**
 * Acciones de acceso, registro y recuperación.
 *
 * CONVENCIÓN DE ERRORES
 * ---------------------
 * `redirect('/ruta?error=' + encodeURIComponent(mensaje))`. Los mensajes están
 * escritos para un pastor, no para un programador: «Ese correo o esa contraseña
 * no son correctos», nunca «invalid_grant».
 */

function volverCon(ruta: string, error: string): never {
  redirect(`${ruta}?error=${encodeURIComponent(error)}`);
}

// ============================================================================
// Acceso
// ============================================================================

const EsquemaAcceso = z.object({
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string().min(1, 'Escribe tu contraseña.'),
  next: z.string().optional(),
});

export async function acceder(formData: FormData) {
  const parsed = EsquemaAcceso.safeParse({
    email: campoObligatorio(formData, 'email'),
    // La contraseña NO pasa por `campo`: recortarla la cambia, y una que
    // termine en espacio dejaria de funcionar sin que nadie entienda por que.
    password: String(formData.get('password') ?? ''),
    next: campo(formData, 'next'),
  });

  if (!parsed.success) {
    volverCon('/acceso', parsed.error.issues[0]!.message);
  }

  const { email, password, next } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    volverCon('/acceso', traducirErrorAuth(error.message));
  }

  // Solo se acepta una ruta interna. Con la URL completa esto sería un
  // redirector abierto: un enlace con nuestro dominio que lleva a otro sitio.
  const destino = next && next.startsWith('/') && !next.startsWith('//')
    ? next
    : '/panel/hoy';

  redirect(destino);
}

// ============================================================================
// Registro de una iglesia
// ============================================================================

const EsquemaRegistro = z.object({
  nombreIglesia: z
    .string()
    .trim()
    .min(3, 'El nombre de la iglesia es demasiado corto.')
    .max(120, 'El nombre de la iglesia es demasiado largo.'),
  nombrePastor: z
    .string()
    .trim()
    .min(2, 'Escribe tu nombre.')
    .max(120, 'Ese nombre es demasiado largo.'),
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
  password: z.string(),
  pais: z.enum(['CO', 'ES']),
  ciudad: z.string().trim().max(120).optional(),
  // El consentimiento del art. 9 no es opcional: sin él no hay base jurídica
  // para tratar el vínculo religioso de nadie, ni siquiera el del pastor.
  consentimiento: z.literal('on', {
    message: 'Tienes que aceptar para poder crear la iglesia.',
  }),
});

export async function registrar(formData: FormData) {
  const parsed = EsquemaRegistro.safeParse({
    nombreIglesia: campoObligatorio(formData, 'nombreIglesia'),
    nombrePastor: campoObligatorio(formData, 'nombrePastor'),
    email: campoObligatorio(formData, 'email'),
    password: String(formData.get('password') ?? ''),
    pais: campoObligatorio(formData, 'pais'),
    ciudad: campo(formData, 'ciudad'),
    consentimiento: formData.get('consentimiento'),
  });

  if (!parsed.success) {
    volverCon('/registro', parsed.error.issues[0]!.message);
  }

  const { nombreIglesia, nombrePastor, email, password, pais, ciudad } =
    parsed.data;

  const errorPassword = validarPassword(password);
  if (errorPassword) volverCon('/registro', errorPassword);

  // Freno al abuso: cinco iglesias por IP y día. No para un ataque decidido,
  // sí para que nadie llene el directorio desde un script.
  const cabeceras = await headers();
  const ip = getClientIp(new Request('https://hatril', { headers: cabeceras }));
  const limite = await checkRateLimit('ip', `registro:${ip}`, 5);
  if (!limite.ok) {
    volverCon(
      '/registro',
      'Se han creado demasiadas iglesias desde esta conexión hoy. Escríbenos y lo resolvemos.',
    );
  }

  const admin = createAdminClient();

  /*
   * Se crea la cuenta ya confirmada, sin correo de verificación.
   *
   * A cambio de la comodidad —el pastor entra al panel en el mismo minuto, sin
   * depender de que un correo llegue y no caiga en spam— se acepta que alguien
   * pueda registrarse con una dirección que no es suya. El riesgo real es que
   * el dueño legítimo de ese correo no pueda registrarse después, no que nadie
   * acceda a datos ajenos: la contraseña sigue siendo necesaria.
   *
   * Se revisa cuando haya correo transaccional montado (Resend), con un aviso
   * de «confirma tu correo» que no bloquee el acceso.
   */
  const { data: creado, error: errorAuth } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nombre: nombrePastor },
  });

  if (errorAuth || !creado.user) {
    volverCon('/registro', traducirErrorAuth(errorAuth?.message ?? ''));
  }

  const resultado = await crearIglesiaConSeeds({
    authUserId: creado.user.id,
    email,
    nombreIglesia,
    nombrePastor,
    pais,
    ciudad,
    ip: ip === 'unknown' ? null : ip,
    userAgent: cabeceras.get('user-agent'),
  });

  if (!resultado.ok) {
    // Si la iglesia no llegó a crearse, la cuenta suelta no sirve para nada y
    // además bloquearía el correo para un segundo intento.
    await admin.auth.admin.deleteUser(creado.user.id);
    volverCon('/registro', resultado.error);
  }

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (errorSesion) {
    // La iglesia existe: no se deshace nada. Solo falló abrir la sesión, y
    // eso se arregla identificándose.
    volverCon('/acceso', 'Tu iglesia ya está creada. Entra con tu correo.');
  }

  redirect('/panel/hoy?bienvenida=1');
}

// ============================================================================
// Recuperar contraseña
// ============================================================================

const EsquemaRecuperar = z.object({
  email: z.string().trim().toLowerCase().email('Ese correo no parece válido.'),
});

export async function pedirRecuperacion(formData: FormData) {
  const parsed = EsquemaRecuperar.safeParse({
    email: campoObligatorio(formData, 'email'),
  });

  if (!parsed.success) {
    volverCon('/recuperar', parsed.error.issues[0]!.message);
  }

  const supabase = await createClient();
  const origen = await getOrigin();

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origen}/auth/confirm?next=/reset-password`,
  });

  /*
   * Se responde lo mismo exista el correo o no, y por eso no se mira el error.
   *
   * Si dijéramos «ese correo no está registrado», cualquiera podría averiguar
   * qué direcciones tienen cuenta. En una plataforma de iglesias eso revela
   * quién pertenece a una congregación, que es justo el dato del art. 9 que
   * estamos protegiendo en todo lo demás.
   */
  redirect('/recuperar?enviado=1');
}

const EsquemaNuevaPassword = z.object({
  password: z.string(),
  repetir: z.string(),
});

export async function cambiarPassword(formData: FormData) {
  const parsed = EsquemaNuevaPassword.safeParse({
    password: String(formData.get('password') ?? ''),
    repetir: String(formData.get('repetir') ?? ''),
  });

  if (!parsed.success) {
    volverCon('/reset-password', 'Revisa la contraseña.');
  }

  const { password, repetir } = parsed.data;

  if (password !== repetir) {
    volverCon('/reset-password', 'Las dos contraseñas no coinciden.');
  }

  const errorPassword = validarPassword(password);
  if (errorPassword) volverCon('/reset-password', errorPassword);

  const supabase = await createClient();

  // `updateUser` solo funciona con la sesión que abre el enlace del correo. Si
  // alguien llega aquí sin ese paso, Supabase lo rechaza.
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    volverCon(
      '/reset-password',
      'El enlace ha caducado. Pide otro desde «He olvidado la contraseña».',
    );
  }

  redirect('/panel/hoy');
}

// ============================================================================
// Salir
// ============================================================================

export async function salir() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/acceso');
}
