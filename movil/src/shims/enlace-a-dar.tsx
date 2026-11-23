import type { AnchorHTMLAttributes, ReactNode } from 'react';

import { WEB_URL } from '@movil/lib/entorno';

/**
 * `EnlaceADar` dentro de la app: SIEMPRE fuera, en el navegador del teléfono.
 *
 * La de la web (`src/app/mi/_components/enlace-a-dar.tsx`) mira el User-Agent
 * en el servidor para decidir. En la app no hay duda: es la app, y la norma
 * 3.2.2 de Apple pide los donativos fuera. Se sustituye al compilar
 * (`movil/vite.config.ts`).
 */
export function EnlaceADar({
  href,
  className,
  children,
  ...resto
}: { href: string; className?: string; children: ReactNode } & Omit<
  AnchorHTMLAttributes<HTMLAnchorElement>,
  'href' | 'className' | 'children' | 'target' | 'rel'
>) {
  return (
    <a href={`${WEB_URL}${href}`} target="_blank" rel="noopener" className={className} {...resto}>
      {children}
    </a>
  );
}
