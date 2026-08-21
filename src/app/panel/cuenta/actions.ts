'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import { requireIglesiaAccion } from '@/lib/auth/guard-panel';
import { withUser } from '@/lib/db';
import { miembros } from '@/lib/db/schema';
import { createClient } from '@/lib/supabase/server';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { validarPassword, traducirErrorAuth } from '@/lib/auth/password';

/**
 * LAS DOS ACTIONS DE AQUÍ VAN CON `sinMuro`
 * ----------------------------------------
 * Son los datos de la PERSONA, no de la iglesia: su nombre, su teléfono y su
 * contraseña. Que la congregación no tenga la suscripción al día no es motivo
 * para impedirle a alguien cambiar una contraseña —que es justo lo que hay que
 * poder hacer con prisa, y el único día que se hace es un mal día—.
 */

const DESTINO = '/panel/cuenta';
const DESTINO_PASSWORD = '/panel/cuenta/contrasena';

function volverCon(ruta: string, mensaje: string): never {
  redirect(`${ruta}?error=` + encodeURIComponent(mensaje));
}

const EsquemaDatos = z.object({
  nombre: z
    .string()
    .min(2, 'Escribe tu nombre.')
    .max(120, 'El nombre es demasiado largo.'),
  apellidos: z.string().max(120, 'Los apellidos son demasiado largos.').optional(),
  telefono: z.string().max(40, 'El teléfono es demasiado largo.').optional(),
});

/**
 * Guardar los datos propios.
 *
 * ESCRIBE EN DOS SITIOS, Y ESA ES LA RAZÓN DE QUE ESTA PANTALLA EXISTA
 * --------------------------------------------------------------------
 * El nombre de una persona vivía por duplicado y sin nadie que los mantuviera
 * juntos: `user_metadata.nombre` en Supabase Auth, que es lo que pintan la
 * cabecera y la firma de los avisos, y `miembros.nombre`, que es lo que sale en
 * el fichero, en los ministerios y en la autoría de los devocionales. Nacían
 * iguales al registrarse y divergían para siempre en cuanto alguien editaba la
 * ficha desde Miembros: la cabecera seguía enseñando el nombre viejo y no había
 * forma de arreglarlo desde ninguna pantalla.
 *
 * Aquí se escriben los dos en el mismo movimiento. No es una transacción entre
 * dos sistemas —Auth y Postgres no comparten transacción— así que el orden
 * importa: primero la ficha, que va por RLS y puede fallar por permisos, y solo
 * si sale bien se toca Auth. Al revés dejaría el metadato cambiado y la ficha
 * intacta, que es la divergencia que se está intentando cerrar.
 *
 * SOLO LA PROPIA FICHA
 * --------------------
 * El `where` va contra `ctx.miembroId`, que sale de la sesión y nunca del
 * formulario. La policy de `miembros` es `for all` dentro de la iglesia —la
 * frontera que garantiza es la de congregación, no la de persona—, así que si
 * el id viniera del cliente, cualquier miembro podría reescribir la ficha de
 * cualquier otro de su iglesia.
 */
export async function guardarMisDatos(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });

  const datos = EsquemaDatos.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    apellidos: campo(formData, 'apellidos'),
    telefono: campo(formData, 'telefono'),
  });

  if (!datos.success) {
    volverCon(DESTINO, datos.error.issues[0]?.message ?? 'Revisa los datos.');
  }

  const { nombre, apellidos, telefono } = datos.data;

  // Hay cuentas sin ficha: quien acaba de entrar y todavía no se le ha creado.
  // Esa persona solo tiene nombre de cuenta, y con eso basta.
  if (ctx.miembroId) {
    await withUser(ctx.user.id, (tx) =>
      tx
        .update(miembros)
        .set({
          nombre,
          apellidos: apellidos ?? null,
          telefono: telefono ?? null,
        })
        .where(eq(miembros.id, ctx.miembroId!)),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { nombre } });

  if (error) {
    volverCon(
      DESTINO,
      'Tus datos se han guardado en la ficha, pero no se ha podido actualizar el nombre de la cuenta. Vuelve a intentarlo.',
    );
  }

  // El nombre se pinta en la cabecera de todas las pantallas, así que no vale
  // con revalidar esta.
  revalidatePath('/', 'layout');
  redirect(`${DESTINO}?guardado=1`);
}

const EsquemaPassword = z.object({
  actual: z.string().min(1, 'Escribe tu contraseña actual.'),
  nueva: z.string().min(1, 'Escribe la contraseña nueva.'),
  repetir: z.string().min(1, 'Repite la contraseña nueva.'),
});

/**
 * Cambiar la contraseña estando dentro.
 *
 * PIDE LA ACTUAL, Y `/reset-password` NO
 * --------------------------------------
 * Son dos flujos distintos y por eso son dos pantallas distintas. A
 * `/reset-password` se llega con un enlace enviado al correo de la persona: el
 * correo ES la prueba de identidad, pedirle además la contraseña que
 * precisamente ha olvidado no tendría sentido.
 *
 * Aquí no hay ninguna prueba de ese tipo. Solo una sesión abierta, que es
 * exactamente lo que tiene quien se sienta delante de un portátil desbloqueado.
 * Sin pedir la actual, esta pantalla convierte «dejarse la sesión abierta» en
 * «perder la cuenta»: el de al lado cambia la contraseña, y como `signOut()` de
 * Supabase es global, echa de todas partes al dueño.
 *
 * La reautenticación es un `signInWithPassword` con el correo de la sesión
 * actual. Es la forma que ofrece Supabase; no existe un «comprobar contraseña»
 * que no inicie sesión.
 */
export async function cambiarMiPassword(formData: FormData) {
  const ctx = await requireIglesiaAccion({ sinMuro: true });

  const datos = EsquemaPassword.safeParse({
    // Sin `campo()`: recorta espacios, y en una contraseña un espacio al final
    // es un carácter como otro cualquiera.
    actual: String(formData.get('actual') ?? ''),
    nueva: String(formData.get('nueva') ?? ''),
    repetir: String(formData.get('repetir') ?? ''),
  });

  if (!datos.success) {
    volverCon(
      DESTINO_PASSWORD,
      datos.error.issues[0]?.message ?? 'Revisa los datos.',
    );
  }

  const { actual, nueva, repetir } = datos.data;

  if (nueva !== repetir) {
    volverCon(DESTINO_PASSWORD, 'Las dos contraseñas nuevas no coinciden.');
  }

  if (nueva === actual) {
    volverCon(
      DESTINO_PASSWORD,
      'La contraseña nueva es la misma que la actual.',
    );
  }

  const errorPassword = validarPassword(nueva);
  if (errorPassword) volverCon(DESTINO_PASSWORD, errorPassword);

  const correo = ctx.user.email;
  if (!correo) {
    volverCon(
      DESTINO_PASSWORD,
      'Tu cuenta no tiene correo, así que no se puede comprobar la contraseña actual.',
    );
  }

  const supabase = await createClient();

  const { error: errorActual } = await supabase.auth.signInWithPassword({
    email: correo,
    password: actual,
  });

  if (errorActual) {
    // Mensaje propio y no el de Supabase: aquí el fallo solo puede ser uno, y
    // «Invalid login credentials» en una pantalla donde el correo no se escribe
    // hace pensar que el problema es la cuenta.
    volverCon(DESTINO_PASSWORD, 'La contraseña actual no es correcta.');
  }

  const { error } = await supabase.auth.updateUser({ password: nueva });

  if (error) {
    volverCon(DESTINO_PASSWORD, traducirErrorAuth(error.message));
  }

  redirect(`${DESTINO}?password=1`);
}
