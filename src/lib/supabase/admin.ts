import { createClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase con service_role — SALTA RLS.
 * Solo para server actions / edge functions / scripts internos.
 * NUNCA usar en componentes cliente ni exponer al navegador.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
