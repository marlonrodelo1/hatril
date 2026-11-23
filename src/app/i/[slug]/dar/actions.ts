'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { checkRateLimit } from '@/lib/api/rate-limit';
import { getOrigin } from '@/lib/auth/get-origin';
import { abrirPagoDonativo } from '@/lib/donativos/cobro';
import { leerFormularioDonativo } from '@/lib/donativos/validacion';
import { createClient } from '@/lib/supabase/server';

/**
 * Abrir el pago de la página de dar.
 *
 * DEVUELVE EL ERROR COMO ESTADO, NO CON `?error=`
 * -----------------------------------------------
 * El resto del repo redirige con `?error=`, y aquí no vale: el formulario son
 * hasta tres líneas con su tipo, su fondo y su cantidad, la casilla de la
 * comisión, el nombre y el correo, y todo eso vive en el estado del cliente.
 * Una redirección vuelve a pintar la página y lo deja a merced de que React
 * conserve el componente. Con `useActionState` la action contesta `{ error }`,
 * el formulario sigue montado tal cual y el aviso sale encima del botón.
 *
 * Lo único que redirige es el éxito, y va a Stripe: `redirect(url)` FUERA de
 * cualquier try/catch, porque `redirect` funciona lanzando un error.
 *
 * QUÉ SE FÍA DEL FORMULARIO
 * -------------------------
 * Nada que cueste dinero. `leerFormularioDonativo` valida la forma, y
 * `abrirPagoDonativo` vuelve a comprobar los fondos contra los que la iglesia
 * ofrece hoy y recalcula la comisión y el total. Lo que enseña el navegador
 * es solo para que la persona vea la cifra antes de pulsar.
 */

export type EstadoDar = { error: string | null };

/**
 * Por IP y al día, como el de los eventos, y con la misma advertencia: falla
 * ABIERTO, la IP la elige quien llama y una iglesia entera dando desde el wifi
 * del templo un domingo comparte una. Por eso es generoso. Frena el abuso
 * torpe (abrir cientos de pagos desde un script, que llenan la tabla de
 * pendientes y la cuenta de Stripe de la iglesia de sesiones vacías); lo que
 * frena a quien prueba tarjetas robadas es Stripe, en su propia página.
 */
const LIMITE_POR_IP = 40;

export async function darDonativo(
  slug: string,
  _previo: EstadoDar,
  formData: FormData,
): Promise<EstadoDar> {
  const parsed = leerFormularioDonativo(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Revisa los datos.' };
  }

  // Después de validar: un formulario mal rellenado no gasta intentos.
  const cabeceras = await headers();
  const ip =
    cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    cabeceras.get('x-real-ip')?.trim() ||
    '';
  const freno = await checkRateLimit('ip', ip ? `donar:${ip}` : '', LIMITE_POR_IP);
  if (!freno.ok) {
    return {
      error: 'Se han abierto demasiados pagos desde aquí hoy. Prueba mañana o usa la transferencia.',
    };
  }

  // La sesión, si la hay, sin exigirla: puede dar quien no tiene cuenta. Con
  // ella, el donativo le aparece después en «Lo que he dado».
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const resultado = await abrirPagoDonativo({
    slug,
    datos: parsed.data,
    authUserId: user?.id ?? null,
    origen: await getOrigin(),
  });

  if ('error' in resultado) {
    return { error: resultado.error };
  }

  redirect(resultado.url);
}
