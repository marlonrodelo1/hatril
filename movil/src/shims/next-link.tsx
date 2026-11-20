import { forwardRef, type AnchorHTMLAttributes } from 'react';
import { Link as EnlaceRouter } from 'react-router';

/**
 * `next/link` dentro de la app: el `Link` de React Router.
 *
 * Existe para reaprovechar los componentes de la web sin tocarlos
 * (`movil/vite.config.ts`). Las rutas de la app son las de la web, así que un
 * `href="/mi/comunidad"` lleva al mismo sitio en los dos lados.
 *
 * Lo que no es de la app —`http…`, `mailto:`, `tel:`— sale como un `<a>`
 * normal: el WebView lo abre fuera.
 */
type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  href: string | { pathname?: string; query?: Record<string, string> };
  prefetch?: boolean | null;
  replace?: boolean;
  scroll?: boolean;
};

const Link = forwardRef<HTMLAnchorElement, Props>(function Link(
  { href, prefetch, replace, scroll, ...resto },
  ref,
) {
  // De Next y sin sentido aquí: se sacan para que no lleguen al `<a>`.
  void prefetch;
  void scroll;
  const destino =
    typeof href === 'string'
      ? href
      : `${href.pathname ?? ''}${href.query ? `?${new URLSearchParams(href.query)}` : ''}`;

  if (/^[a-z][a-z0-9+.-]*:/i.test(destino)) {
    return <a ref={ref} href={destino} {...resto} />;
  }
  return <EnlaceRouter ref={ref} to={destino} replace={replace} {...resto} />;
});

export default Link;
