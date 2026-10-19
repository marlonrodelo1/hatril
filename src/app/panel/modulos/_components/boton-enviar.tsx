'use client';

import { useFormStatus } from 'react-dom';

import { Button } from '@/components/ui/button';

/**
 * El botón de «Activar» y «Añadir otro», desactivado mientras la action corre.
 *
 * Cada pulsación crea un ministerio. «Activar» aguanta un doble clic en el
 * servidor —si ya hay uno, lo abre—, pero «Añadir otro» no puede: dos clics son
 * dos equipos, «Alabanza 2» y «Alabanza 3». Cortarlo aquí es lo único que lo
 * evita sin inventarse una clave de idempotencia.
 */
export function BotonEnviar({
  variant,
  size,
  className,
  children,
}: {
  variant?: 'secondary' | 'ghost' | 'outline';
  size?: 'default' | 'sm';
  className?: string;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      aria-busy={pending}
    >
      {children}
    </Button>
  );
}
