/**
 * Las tres direcciones que la app necesita, leídas al compilar.
 *
 * `VITE_API_URL` es hatril.com en el binario y el Next local en desarrollo.
 * La pone `scripts/app/*.mjs` a partir de `CAP_SERVER_URL`, con la misma
 * exigencia de https que tenía el WebView: un binario que hable con la base en
 * claro no se compila.
 *
 * Las de Supabase son las de la web (`NEXT_PUBLIC_SUPABASE_*`), públicas por
 * diseño: solo sirven para iniciar y refrescar la sesión. Los datos no se
 * leen de Supabase, sino de la API (`docs/app-nativa/plan-spa.md` §2).
 */
function obligatoria(nombre: string, valor: string | undefined): string {
  if (!valor) throw new Error(`Falta ${nombre} al compilar la app.`);
  return valor.replace(/\/$/, '');
}

export const API_URL = obligatoria(
  'VITE_API_URL',
  import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://localhost:3000' : undefined),
);

export const SUPABASE_URL = obligatoria(
  'NEXT_PUBLIC_SUPABASE_URL',
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_CLAVE_PUBLICABLE = obligatoria(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

/** La web, para lo que la app abre fuera: el panel, Dar, la política. */
export const WEB_URL = API_URL;
