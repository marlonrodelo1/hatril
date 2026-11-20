import { createClient } from '@supabase/supabase-js';

import { endpointApp, publica, sinContenido } from '@/lib/api/app';
import { EsquemaRecuperar } from '@/lib/app-api/solicitud';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * «He olvidado la contraseña», desde la app.
 *
 * Es `pedirRecuperacion` (`src/app/(auth)/actions.ts`): Supabase manda el
 * correo, y su enlace abre la WEB (`/auth/confirm` → `/reset-password`), no
 * la app. Cambiar la contraseña se hace allí; luego se entra en la app con la
 * nueva.
 *
 * Contesta lo mismo exista el correo o no, y por eso no mira el error: decir
 * «ese correo no está registrado» dejaría averiguar quién pertenece a una
 * congregación, que es justo el dato del art. 9.
 *
 * La vuelta va a la dirección pública de la web y no a la de la petición: la
 * pide un teléfono, cuyo origen es `capacitor://localhost`.
 */
export const POST = endpointApp({ guarda: publica, entrada: EsquemaRecuperar }, async ({ entrada }) => {
  const web = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await supabase.auth.resetPasswordForEmail(entrada.email, {
    redirectTo: `${web}/auth/confirm?next=/reset-password`,
  });
  return sinContenido();
});
