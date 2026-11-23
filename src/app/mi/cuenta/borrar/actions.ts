'use server';

import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/api/rate-limit';
import {
  bajaPendiente,
  pedirBajaDeCuenta,
  porQueNoSePuedeBorrar,
  recuperarCuenta,
} from '@/lib/cuenta/baja';

const DESTINO = '/mi/cuenta/borrar';

function volver(mensaje: string): never {
  redirect(`${DESTINO}?error=` + encodeURIComponent(mensaje));
}

/**
 * «Borrar mi cuenta».
 *
 * SIN `requireIglesiaAccion`, Y ES A PROPÓSITO
 * --------------------------------------------
 * Pide sesión, no iglesia. Quien tiene una solicitud pendiente, o a quien su
 * iglesia dio de baja, también tiene cuenta y también tiene derecho a borrarla
 * —Apple y Google lo piden para toda cuenta que se pueda crear—. Y no pasa por
 * el muro de suscripción: darse de baja es de lo que nunca se bloquea.
 *
 * LA CONTRASEÑA
 * -------------
 * Se pide para confirmar, como al cambiarla: un móvil desbloqueado encima de
 * una mesa no debería bastar para borrarle la cuenta a nadie. Se comprueba con
 * `signInWithPassword`, que es lo que ofrece Supabase, y con un tope de intentos
 * al día por cuenta, para que esto no sirva de adivinador de contraseñas.
 */
export async function pedirBaja(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect('/acceso?next=' + encodeURIComponent(DESTINO));

  // Sin `campo()`: recorta espacios, y en una contraseña un espacio es un
  // carácter más.
  const password = String(formData.get('password') ?? '');
  if (!password) volver('Escribe tu contraseña para confirmar.');

  const limite = await checkRateLimit('usuario', `baja:${user.id}`, 5);
  if (!limite.ok) {
    volver('Has probado demasiadas veces. Vuelve a intentarlo mañana.');
  }

  const motivo = await porQueNoSePuedeBorrar(user.id);
  if (motivo) volver(motivo);

  const { error } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (error) volver('La contraseña no es correcta.');

  const { borrarDesde } = await pedirBajaDeCuenta(user.id);

  // En todos sus dispositivos: desactivar la cuenta y dejar una sesión abierta
  // en la tableta de casa no sería desactivarla.
  await supabase.auth.signOut({ scope: 'global' });

  redirect(`/borrar-cuenta?pedida=${borrarDesde.toISOString().slice(0, 10)}`);
}

/** Arrepentirse antes de los treinta días. */
export async function recuperar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso');

  if (await bajaPendiente(user.id)) await recuperarCuenta(user.id);
  redirect('/mi');
}
