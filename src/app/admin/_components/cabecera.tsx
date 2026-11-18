import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
 *
 * LA MIGA DE PAN, COMO LA DEL PANEL (zona 4, 18-nov)
 * --------------------------------------------------
 * En una ficha, «Iglesias › Betania»: de dónde cuelga y dónde estás. En el
 * móvil se queda en «‹ Iglesias», que allí es sobre todo volver.
 *
 * En las cuatro secciones, «Administración › Inicio», que es lo que enseña la
 * propuesta aprobada: el panel no la necesita porque arriba del menú está la
 * iglesia, pero aquí el lateral se puede plegar al logo y entonces nada más en
 * la pantalla dice en qué lado de la plataforma estás. Solo en escritorio: en
 * el móvil el título ya lo dice y una línea más empuja el contenido.
 *
 * La API no ha cambiado: lo nuevo (`insignia`) es opcional, y las pantallas
 * que la llamaban como antes siguen igual.
 */
export async function CabeceraAdmin({
  titulo,
  subtitulo,
  volver,
  insignia,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  /** La miga de las fichas: a qué lista se vuelve. */
  volver?: { href: string; texto: string };
  /** Una `<Insignia>` junto al título: la situación de una iglesia. */
  insignia?: React.ReactNode;
  /** Las acciones de ESTA pantalla. */
  children?: React.ReactNode;
}) {
  const admin = await requireSuperAdmin();

  return (
    <header className="sticky top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-3 border-b border-border bg-surface px-4 py-3 md:flex-nowrap md:gap-x-6 md:px-8 md:py-4">
      <AdminMenuMovil />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        {volver ? (
          <nav
            aria-label="Estás en"
            className="flex min-w-0 items-center gap-1 text-label text-muted-foreground"
          >
            <Link
              href={volver.href}
              className="-ml-1 inline-flex flex-none items-center gap-0.5 rounded-md text-muted-foreground no-underline transition-colors duration-150 hover:text-foreground hover:no-underline md:ml-0"
            >
              <ChevronLeft className="size-4 md:hidden" strokeWidth={1.8} />
              {volver.texto}
            </Link>
            <ChevronRight
              className="hidden size-3.5 flex-none md:block"
              strokeWidth={1.8}
              aria-hidden
            />
            <span className="hidden truncate md:block">{titulo}</span>
          </nav>
        ) : (
          <nav
            aria-label="Estás en"
            className="hidden min-w-0 items-center gap-1 text-label text-muted-foreground md:flex"
          >
            <span className="flex-none">Administración</span>
            <ChevronRight className="size-3.5 flex-none" strokeWidth={1.8} aria-hidden />
            <span className="truncate">{titulo}</span>
          </nav>
        )}

        <div className="flex min-w-0 items-center gap-2.5">
          <h1 className="truncate text-[20px] font-bold leading-tight tracking-[-0.025em] md:text-[22px]">
            {titulo}
          </h1>
          {insignia}
        </div>

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
