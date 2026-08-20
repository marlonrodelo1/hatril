'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { sql } from 'drizzle-orm';
import { z } from 'zod';

import { dbAdmin } from '@/lib/db';
import { campo, campoObligatorio } from '@/lib/api/formulario';
import { checkRateLimit } from '@/lib/api/rate-limit';
import { VERSION_POLITICA_PRIVACIDAD } from '@/lib/rgpd/consentimiento';
import { MAX_ACOMPANANTES } from '@/app/panel/eventos/constantes';

/**
 * Apuntarse a un evento sin tener cuenta.
 *
 * ES LA PRIMERA ESCRITURA DE LA PLATAFORMA QUE HACE UN DESCONOCIDO
 * ----------------------------------------------------------------
 * Hasta hoy, todo lo que se escribía en Hatril lo escribía alguien con sesión:
 * `solicitarIngreso` echa a `/acceso` a quien no la tiene. Aquí no, porque el
 * caso normal es el vecino que vio el cartel.
 *
 * POR QUÉ LLAMA A UNA FUNCIÓN DE POSTGRES Y NO HACE EL INSERT AQUÍ
 * ----------------------------------------------------------------
 * Tres cosas que solo se pueden hacer dentro de la base:
 *
 *   1. Contar el aforo bajo cerrojo. Un aforo es un agregado: no hay CHECK ni
 *      unique que lo defienda, y sin `for update` dos personas se llevan la
 *      última plaza a la vez. En un evento de pago eso es devolver dinero.
 *   2. Generar el código de cancelación en el servidor, con un generador que no
 *      sea `Math.random()`.
 *   3. Responder lo mismo a un correo nuevo y a uno ya inscrito. Si eso se
 *      decidiera aquí arriba, el `unique_violation` llegaría igual y habría que
 *      distinguirlo — y ahí está el oráculo.
 *
 * La función NO está concedida a nadie: la ejecuta `postgres`, su dueño, porque
 * la llama `dbAdmin`. No hay `POST /rest/v1/rpc/` abierto a internet.
 *
 * EL FRENO POR IP VA AQUÍ Y NO EN LA BASE
 * ---------------------------------------
 * `checkRateLimit` falla ABIERTO a propósito, y ese es el comportamiento
 * correcto para una IP: la clave la elige quien llama —`x-forwarded-for` es
 * falsificable— y una iglesia entera apuntándose desde el wifi del templo un
 * domingo comparte una sola IP. Sirve para el abuso torpe y nada más. Los
 * límites que de verdad acotan el daño están dentro de la función, con claves
 * que el visitante no puede rotar: por evento y por correo.
 */

const Esquema = z.object({
  nombre: z.string().trim().min(2, 'Escribe tu nombre.').max(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Ese correo no parece válido.')
    .max(200),
  telefono: z.string().trim().max(32).optional(),
  acompanantes: z.string().trim().optional(),
  nota: z.string().trim().max(500).optional(),
  // Casilla nativa: el navegador manda 'on' o no manda el campo. Es un
  // `z.literal` y no un booleano para que el mensaje lo dé Zod.
  consentimiento: z.literal('on', {
    message: 'Tienes que aceptar que la iglesia guarde tus datos para el evento.',
  }),
});

/**
 * Qué se le dice a quien acaba de enviar el formulario.
 *
 * `ok` es lo mismo para un alta nueva y para un correo ya apuntado, y no es un
 * descuido: si la pantalla dijera «ya estabas inscrito», cualquiera podría
 * averiguar con una lista de correos quién va a un acto de una congregación.
 * Eso es confesión religiosa por inferencia, art. 9 del RGPD.
 */
const MENSAJES: Record<string, string> = {
  datos: 'Revisa los datos: falta algo o hay algo mal escrito.',
  no_disponible: 'Ese evento ya no está disponible.',
  cerrado: 'Las inscripciones de este evento están cerradas.',
  pasado: 'Este evento ya ha pasado.',
  completo: 'Ya no quedan plazas.',
  limite: 'Se han hecho demasiadas inscripciones desde aquí hoy. Prueba mañana.',
};

export async function inscribirse(
  slug: string,
  eventoId: string,
  formData: FormData,
): Promise<void> {
  const destino = `/i/${slug}/eventos/${eventoId}`;

  const parsed = Esquema.safeParse({
    nombre: campoObligatorio(formData, 'nombre'),
    email: campoObligatorio(formData, 'email'),
    telefono: campo(formData, 'telefono'),
    acompanantes: campo(formData, 'acompanantes'),
    nota: campo(formData, 'nota'),
    consentimiento: campo(formData, 'consentimiento'),
  });

  if (!parsed.success) {
    redirect(
      `${destino}?error=` +
        encodeURIComponent(parsed.error.issues[0]?.message ?? 'Revisa los datos.'),
    );
  }

  const d = parsed.data;

  const acompanantes = Math.min(
    Math.max(Number(d.acompanantes ?? '0') || 0, 0),
    MAX_ACOMPANANTES,
  );

  const cabeceras = await headers();
  const ip =
    cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    cabeceras.get('x-real-ip')?.trim() ??
    null;
  const userAgent = cabeceras.get('user-agent');

  // Freno torpe, fail-open. Un número generoso: lo que de verdad limita está
  // dentro de la función.
  const freno = await checkRateLimit('ip', ip ?? '', 60);
  if (!freno.ok) {
    redirect(`${destino}?error=` + encodeURIComponent(MENSAJES.limite!));
  }

  const filas = await dbAdmin.execute<{ resultado: string }>(sql`
    select public.inscribir_en_evento(
      ${eventoId}::uuid,
      ${d.nombre},
      ${d.email},
      ${VERSION_POLITICA_PRIVACIDAD},
      ${d.telefono ?? null},
      ${acompanantes},
      ${d.nota ?? null},
      ${ip},
      ${userAgent}
    ) as resultado
  `);

  // postgres-js devuelve el array de filas directamente; otros drivers lo
  // envuelven en `.rows`. Se cubren los dos, igual que en `rate-limit.ts`.
  const fila =
    (filas as unknown as { rows?: { resultado: string }[] }).rows?.[0] ??
    (filas as unknown as Array<{ resultado: string }>)[0];

  const resultado = fila?.resultado ?? 'no_disponible';

  if (resultado !== 'ok') {
    redirect(
      `${destino}?error=` +
        encodeURIComponent(MENSAJES[resultado] ?? MENSAJES.no_disponible!),
    );
  }

  // La lista del panel es dinámica, pero la web pública va con ISR y el evento
  // podría acabar de llenarse.
  revalidatePath(`/i/${slug}`);

  redirect(`${destino}/listo`);
}
