import { createClient } from '@supabase/supabase-js';

import { SUPABASE_CLAVE_PUBLICABLE, SUPABASE_URL } from './entorno';

/**
 * Supabase en el teléfono, SOLO para la sesión: entrar, refrescar el token y
 * salir. Ni una consulta a tablas: `authenticated` no tiene permisos sobre
 * ellas a propósito (CLAUDE.md, «Por qué `hatril_app` y no `authenticated`»),
 * y los datos llegan por la API con este token (`./api.ts`).
 *
 * La sesión se guarda en el almacenamiento del WebView, dentro del espacio
 * aislado de la app. Es el mismo nivel que las cookies del WebView que cargaba
 * hatril.com: no empeora nada. Es como lo hacen Pidoo y Gonper socio.
 *
 * `detectSessionInUrl: false`: la app no recibe enlaces de Supabase. El de
 * recuperar la contraseña y el de confirmar el correo abren la web.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_CLAVE_PUBLICABLE, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: 'hatril-sesion',
  },
});
