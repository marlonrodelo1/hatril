import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { createClient } from '@/lib/supabase/server';
import { asegurarNombre } from '@/lib/auth/acceso-social';
import { getOrigin } from '@/lib/auth/get-origin';
import { captureException } from '@/lib/observability/sentry';
import { destinoSeguro } from '@/lib/url/destino-seguro';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * La vuelta de Google en la web (`entrarConGoogle` en `(auth)/actions.ts`).
 *
 * Supabase manda aquí un `code` de un solo uso, y `exchangeCodeForSession` lo
 * canjea por la sesión con el verificador PKCE que dejó en una cookie al salir
 * hacia Google: un `code` copiado de otro navegador no sirve sin esa cookie.
 *
 * Las redirecciones se construyen con `getOrigin()` y no con `request.url`, que
 * detrás del proxy de Dokploy puede llegar como `localhost:3000`.
 */

const EsquemaVuelta = z.object({
  code: z.string().min(1).max(512).optional(),
  // Si la persona cancela en Google, Supabase vuelve con `error` y sin `code`.
  error: z.string().max(200).optional(),
  next: z.string().max(2048).optional(),
});

export async function GET(request: NextRequest) {
  const origen = await getOrigin();
  const parsed = EsquemaVuelta.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );
  const next = parsed.success ? destinoSeguro(parsed.data.next) : null;

  const alAcceso = (error?: string) => {
    const url = new URL('/acceso', origen);
    if (error) url.searchParams.set('error', error);
    if (next) url.searchParams.set('next', next);
    return NextResponse.redirect(url);
  };

  if (!parsed.success) return alAcceso('Ese enlace no es válido.');
  // Cancelar no es un error que haya que explicar: vuelve a la pantalla de
  // entrar, como si no hubiera pulsado.
  if (parsed.data.error === 'access_denied') return alAcceso();
  if (!parsed.data.code) {
    return alAcceso('No hemos podido entrar con Google. Inténtalo otra vez.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    parsed.data.code,
  );

  if (error || !data.user) {
    await captureException(error ?? 'exchangeCodeForSession sin usuario', {
      action: 'acceso_google_callback',
    });
    return alAcceso(
      'No hemos podido entrar con Google. Si se repite, entra con tu correo.',
    );
  }

  await asegurarNombre(supabase, data.user);

  // Sin destino, a `/mi`, que reparte con `inicioDe()` (como `/auth/confirm`).
  return NextResponse.redirect(new URL(next ?? '/mi', origen));
}
