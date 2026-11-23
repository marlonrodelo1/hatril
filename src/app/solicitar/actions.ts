'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

import { z } from 'zod';

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
  rutaDeSolicitud,
} from '@/lib/solicitudes/alta';
import { leerCodigo } from '@/lib/grupos/codigo';
import { sumarInvitacion } from '@/lib/grupos/invitacion';

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
  // `&` si la ruta ya trae su consulta: la de una invitación lleva `?grupo=`, y
  // con un segundo `?` el error se pegaba al código —«?grupo=X?error=…»—, el
  // código dejaba de leerse y la persona perdía el mensaje y la célula.
  const separador = ruta.includes('?') ? '&' : '?';
  redirect(`${ruta}${separador}error=${encodeURIComponent(error)}${extra}`);
}

async function ipDeLaPeticion(): Promise<string> {
  return getClientIp(new Request('https://hatril', { headers: await headers() }));
}

export async function solicitarIngreso(formData: FormData) {
  const parsed = EsquemaSolicitud.safeParse(leerSolicitud(formData));
  const slug = String(formData.get('slug') ?? '');
  // La vuelta conserva el código de la célula que invita, si lo hay.
  const volverA = rutaDeSolicitud(slug, leerCodigo(campo(formData, 'grupo')));

  if (!parsed.success) {
    volverCon(volverA, parsed.error.issues[0]!.message);
  }

  const user = await usuarioActual();
  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(volverA)}`);
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
  const volverA = rutaDeSolicitud(slug, leerCodigo(campo(formData, 'grupo')));
  const volver: (error: string) => never = (error) => volverCon(volverA, error);

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
    volverCon('/acceso', 'Tu cuenta ya está creada. Entra con tu correo.', volverA);
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

const EsquemaSumarInvitacion = z.object({
  slug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  grupo: z.string().optional(),
});

/**
 * Quien ya había pedido entrar sin enlace abre el de una célula y pulsa «Sí,
 * entrar también en…»: su solicitud pendiente lleva esa invitación. La lógica
 * y sus porqués, en `sumarInvitacion` (`src/lib/grupos/invitacion.ts`).
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

  const user = await usuarioActual();
  if (!user) {
    redirect(`/acceso?next=${encodeURIComponent(rutaDeSolicitud(slug, codigo))}`);
  }

  const hecho = await sumarInvitacion(user.id, slug, codigo);
  redirect(hecho === 'sumada' ? '/mi?invitacion=1' : '/mi');
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
