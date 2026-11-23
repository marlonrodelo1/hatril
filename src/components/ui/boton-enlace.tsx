import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import type { VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

/**
 * Un enlace con forma de botón.
 *
 * POR QUÉ EXISTE
 * --------------
 * `<Button render={<Link/>}>` hace que Base UI avise por consola en cada
 * pantalla y le pone `type="button"` a un `<a>`; `nativeButton={false}` no lo
 * arregla, le pone `role="button"` y un lector anuncia un enlace como botón
 * (guía visual, «Botones»). La forma buena era pintar un `<Link>` con las
 * clases del botón, y cada pantalla la escribía a mano.
 *
 * ELIGE SOLO ENTRE `<Link>` Y `<a>`
 * ---------------------------------
 * `<a>` para anclas, `tel:`, `mailto:`, enlaces de fuera y lo que sirve un
 * route handler (el CSV): `Link` intentaría precargarlos. `<Link>` para todo
 * lo demás.
 *
 * `cn` aquí sí: hay que poder QUITAR una clase de la variante desde fuera
 * (como el dorado de la portada quita `bg-primary`), no solo añadir.
 */
type Props = {
  href: string;
  className?: string;
  /** Abre en otra pestaña: para mirar algo sin irse (la web de la iglesia). */
  nuevaPestana?: boolean;
  /**
   * Un `<a>` de verdad aunque la dirección sea interna: lo que sirve un route
   * handler (la descarga del CSV de `/panel/…/exportar`), que `Link` intentaría
   * precargar como si fuera una página.
   */
  nativo?: boolean;
  children: ReactNode;
} & VariantProps<typeof buttonVariants> &
  Pick<ComponentProps<typeof Link>, 'prefetch' | 'scroll' | 'replace'> &
  Omit<ComponentProps<'a'>, 'href' | 'className' | 'children'>;

export function BotonEnlace({
  href,
  variant,
  size,
  className,
  nuevaPestana = false,
  nativo = false,
  prefetch,
  scroll,
  replace,
  children,
  ...resto
}: Props) {
  const clases = cn(buttonVariants({ variant, size }), className);
  const deFuera =
    /^(https?:|mailto:|tel:|#)/.test(href) || href.startsWith('/api/');

  if (deFuera || nuevaPestana || nativo) {
    return (
      <a
        href={href}
        className={clases}
        {...(nuevaPestana ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        {...resto}
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      scroll={scroll}
      replace={replace}
      className={clases}
      {...resto}
    >
      {children}
    </Link>
  );
}
