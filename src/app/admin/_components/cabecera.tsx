import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

import { requireSuperAdmin } from '@/lib/auth/super-admin';
import { MenuCuenta } from '@/components/menu-cuenta';
import { AdminMenuMovil } from './menu-movil';

/**
 * La cabecera de cualquier pantalla de `/admin`. La misma forma que
 * `CabeceraPanel`, sin campana: los avisos son de una iglesia, y aquí no se
 * está dentro de ninguna.
 *
 * El menú de cuenta va con `soloSalir`: sus otras entradas —tus datos, la
 * contraseña, la suscripción— viven bajo `/panel` y piden iglesia. La cuenta
 * de super admin no tiene ninguna, y le rebotarían a `/mi`.
 */
export async function CabeceraAdmin({
  titulo,
  subtitulo,
  volver,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  volver?: { href: string; texto: string };
  children?: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-border bg-surface px-4 py-3 md:flex-nowrap md:gap-x-6 md:px-8 md:py-4">
      <AdminMenuMovil />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {volver && (
          <Link
            href={volver.href}
            className="-ml-1 inline-flex w-fit items-center gap-0.5 text-label text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            <ChevronLeft className="size-4" strokeWidth={1.9} />
            {volver.texto}
          </Link>
        )}

        <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.025em] md:text-[22px]">
          {titulo}
        </h1>

        {subtitulo && (
          <p className="truncate text-label text-muted-foreground">{subtitulo}</p>
        )}
      </div>

      {children && (
        <div className="order-last flex w-full flex-none items-center gap-2 md:order-none md:w-auto md:gap-3">
          {children}
        </div>
      )}

      <div className="flex flex-none items-center gap-1">
        <MenuCuenta
          nombre={admin.email.split('@')[0] ?? admin.email}
          correo={admin.email}
          rol="Super admin"
          soloSalir
        />
      </div>
    </header>
  );
}
