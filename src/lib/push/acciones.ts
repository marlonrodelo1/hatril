'use server';

import { sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { z } from 'zod';

import { withUser } from '@/lib/db';
import { createClient } from '@/lib/supabase/server';
import { COOKIE_PUSH } from './dispositivo';

/**
 * Apuntar el teléfono de quien tiene la sesión para mandarle push.
 *
 * La llama `components/push-nativo.tsx` desde dentro de la app. Es una server
 * action y no un `route.ts` porque así hereda la comprobación de origen de
 * Next: una página de otro sitio no puede hacer que el navegador de alguien
 * apunte un token ajeno a su cuenta.
 *
 * SOLO PIDE SESIÓN
 * ----------------
 * Como `/mi/avisos`: quien está esperando a que le acepten en una iglesia no
 * tiene membresía, y «ya eres parte de…» es justo el aviso que más espera.
 * La cuenta sale de la sesión; la función de la 0058 vuelve a sacarla de
 * `auth.uid()` y no acepta otra.
 *
 * En este fichero solo va lo que puede llamar el navegador: todo lo que se
 * exporta desde un `'use server'` es una action pública. Lo de «Salir» vive en
 * `dispositivo.ts`, que es solo de servidor.
 */

const Esquema = z.object({
  // Un token de FCM son letras, cifras, dos puntos, guiones y guiones bajos.
  token: z.string().min(20).max(4096).regex(/^[A-Za-z0-9:_-]+$/),
  plataforma: z.enum(['ios', 'android']),
});

export async function registrarDispositivo(
  token: unknown,
  plataforma: unknown,
): Promise<{ ok: boolean }> {
  const parsed = Esquema.safeParse({ token, plataforma });
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };

  await withUser(user.id, (tx) =>
    tx.execute(
      sql`select public.registrar_dispositivo_push(${parsed.data.token}, ${parsed.data.plataforma})`,
    ),
  );

  // httpOnly: la página no la necesita, y así un script ajeno no la lee.
  (await cookies()).set(COOKIE_PUSH, parsed.data.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });

  return { ok: true };
}
