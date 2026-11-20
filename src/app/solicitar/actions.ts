'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { createClient } from '@/lib/supabase/server';
import { getClientIp } from '@/lib/api/rate-limit';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { destinoSeguro } from '@/lib/url/destino-seguro';
import { usuarioActual } from '@/lib/auth/usuario';
import {
  EsquemaCuentaPersonal,
  EsquemaCuentaYSolicitud,
  MENSAJE_CORREO_CON_CUENTA,
  EsquemaSolicitud,
  leerSolicitud,
  type DatosSolicitud,
} from '@/lib/app-api/solicitud';
import {
  cancelarSolicitudDe,
  crearCuentaPersonal as crearCuenta,
  registrarSolicitud as registrar,
} from '@/lib/solicitudes/alta';

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
 * LA LÓGICA VIVE EN `src/lib/solicitudes/alta.ts` (20-nov)
 * --------------------------------------------------------
 * Para que la app empaquetada la use sin copiarla. Aquí queda lo que es de la
 * web: leer el formulario, abrir la sesión con su cookie y redirigir.
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

async function ipDeLaPeticion(): Promise<string> {
  return getClientIp(new Request('https://hatril', { headers: await headers() }));
}

export async function solicitarIngreso(formData: FormData) {
  const parsed = EsquemaSolicitud.safeParse(leerSolicitud(formData));
  const slug = String(formData.get('slug') ?? '');

  if (!parsed.success) {
    volverCon(`/solicitar/${slug}`, parsed.error.issues[0]!.message);
  }

  const user = await usuarioActual();
  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(`/solicitar/${parsed.data.slug}`)}`);
  }

  await registrarYVolver(user, parsed.data);
}

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
  const volver: (error: string) => never = (error) => volverCon(`/solicitar/${slug}`, error);

  const parsed = EsquemaCuentaYSolicitud.safeParse({
    ...leerSolicitud(formData),
    email: campoObligatorio(formData, 'email'),
    password: String(formData.get('password') ?? ''),
  });
  if (!parsed.success) volver(parsed.error.issues[0]!.message);

  const { email, password, ...solicitud } = parsed.data;

  const creada = await crearCuenta({ nombre: solicitud.nombre, email, password }, await ipDeLaPeticion());
  if (!creada.ok) {
    volver(
      creada.yaExiste
        ? MENSAJE_CORREO_CON_CUENTA
        : creada.error,
    );
  }

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password });
  if (errorSesion) {
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.', `/solicitar/${slug}`);
  }

  await registrarYVolver(creada.user, solicitud);
}

/** La solicitud, y a dónde va la web según lo que haya pasado. */
async function registrarYVolver(
  user: Parameters<typeof registrar>[0],
  d: DatosSolicitud,
): Promise<never> {
  const r = await registrar(user, d);
  if (!r.ok) volverCon(r.ir, r.error);
  // Ya tenía iglesia o solicitud: `/mi` le cuenta en qué punto está.
  redirect(r.resultado === 'enviada' ? '/mi?enviada=1' : '/mi');
}

/** Cancelar la solicitud propia mientras está pendiente. */
export async function cancelarSolicitud() {
  const user = await usuarioActual();
  if (!user) redirect('/acceso');

  await cancelarSolicitudDe(user.id);

  redirect('/mi?cancelada=1');
}

export async function crearCuentaPersonal(formData: FormData) {
  const next = campo(formData, 'next');
  const parsed = EsquemaCuentaPersonal.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    email: campoObligatorio(formData, 'email'),
    password: String(formData.get('password') ?? ''),
  });

  if (!parsed.success) {
    volverCon('/crear-cuenta', parsed.error.issues[0]!.message, next);
  }

  const { email, password } = parsed.data;

  const creada = await crearCuenta(parsed.data, await ipDeLaPeticion());
  if (!creada.ok) volverCon('/crear-cuenta', creada.error, next);

  const supabase = await createClient();
  const { error: errorSesion } = await supabase.auth.signInWithPassword({ email, password });

  if (errorSesion) {
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.', next);
  }

  redirect(destinoSeguro(next) ?? '/mi');
}
