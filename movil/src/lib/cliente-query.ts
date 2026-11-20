import { QueryClient } from '@tanstack/react-query';

/**
 * La caché de datos de la app, una para toda ella.
 *
 * SOLO EN MEMORIA
 * ---------------
 * Es lo que hace rápido cambiar de pestaña: volver a una pinta lo último al
 * instante y lo refresca por detrás. Pero no se guarda en disco, a propósito:
 * son datos del art. 9 (`docs/app-nativa/plan-spa.md` §3) y al cerrar sesión
 * tienen que desaparecer (`./sesion.tsx`).
 *
 * `retry: 1` y no los tres de serie, y ninguno con un 4xx: un 403 o un 404 no
 * se arreglan insistiendo, y sin red el aviso tiene que salir pronto.
 *
 * Va en su propio módulo porque la usan también las actions
 * (`./acciones.ts`), que no son componentes.
 */
export const clienteQuery = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 30 * 60_000,
      retry: (fallos, error) => {
        const status = (error as { status?: number }).status ?? 0;
        return fallos < 1 && !(status >= 400 && status < 500);
      },
      refetchOnWindowFocus: true,
    },
  },
});
