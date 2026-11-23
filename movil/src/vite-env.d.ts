/// <reference types="vite/client" />

/**
 * Las variables que la app lee al compilar (`lib/entorno.ts`). Solo pasan las
 * que empiezan por `VITE_` o `NEXT_PUBLIC_SUPABASE_` (`vite.config.ts`).
 */
interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
