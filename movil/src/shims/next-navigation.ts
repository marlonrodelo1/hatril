import { useMemo } from 'react';
import { useLocation, useNavigate, useParams as useParamsRouter } from 'react-router';

/**
 * `next/navigation` dentro de la app, con React Router debajo.
 *
 * Solo lo que usan los componentes de cliente que se reaprovechan de la web:
 * `useRouter`, `usePathname`, `useSearchParams` y `useParams`. `redirect` y
 * `notFound` son de servidor y aquí no tienen sentido: si un componente
 * compartido los importa, que falle al compilar y se vea.
 */
export function usePathname(): string {
  return useLocation().pathname;
}

export function useSearchParams(): URLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

export function useParams<T extends Record<string, string>>(): T {
  return useParamsRouter() as T;
}

export function useRouter() {
  const navegar = useNavigate();
  return useMemo(
    () => ({
      push: (ruta: string) => navegar(ruta),
      replace: (ruta: string) => navegar(ruta, { replace: true }),
      back: () => navegar(-1),
      forward: () => navegar(1),
      // En la web vuelve a pedir la página al servidor. Aquí los datos los
      // refresca React Query: no hay nada que recargar.
      refresh: () => {},
      prefetch: () => {},
    }),
    [navegar],
  );
}
