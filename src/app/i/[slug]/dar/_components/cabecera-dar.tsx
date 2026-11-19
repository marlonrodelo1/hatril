import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { iniciales } from '@/lib/format/iniciales';

/**
 * Quién recibe: el logo, el nombre y la ciudad. Lo primero que mira quien da
 * por primera vez es que el dinero va a SU iglesia.
 *
 * La flecha de volver solo si la iglesia tiene web: sin ella no hay a dónde
 * volver que no sea pedir una sesión (`/mi`), y a esta página llega también
 * quien no tiene cuenta.
 *
 * Las iniciales van en el naranja suave y no en el relleno naranja de la
 * cabecera de la web: aquí abajo está el botón de pagar, y un cuadro naranja
 * arriba le hace la competencia (regla 1).
 */
export function CabeceraDar({
  titulo,
  iglesia,
}: {
  titulo: string;
  iglesia: {
    slug: string;
    nombre: string;
    ciudad: string | null;
    logoUrl: string | null;
    webPublica: boolean;
  };
}) {
  return (
    <header className="flex items-center gap-3">
      {iglesia.webPublica && (
        <Link
          href={`/i/${iglesia.slug}`}
          aria-label={`Volver a ${iglesia.nombre}`}
          className="-ml-2 flex size-10 flex-none items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-surface-active hover:text-foreground hover:no-underline"
        >
          <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
        </Link>
      )}
      {iglesia.logoUrl ? (
        <Image
          src={iglesia.logoUrl}
          alt=""
          width={44}
          height={44}
          className="size-11 flex-none rounded-lg border border-border bg-surface object-cover"
        />
      ) : (
        <span
          aria-hidden
          className="flex size-11 flex-none items-center justify-center rounded-lg border border-border bg-accent text-label font-extrabold text-accent-foreground"
        >
          {iniciales(iglesia.nombre)}
        </span>
      )}
      <div className="flex min-w-0 flex-col">
        <h1 className="t-subtitulo text-pretty">{titulo}</h1>
        {iglesia.ciudad && (
          <p className="truncate text-label text-muted-foreground">{iglesia.ciudad}</p>
        )}
      </div>
    </header>
  );
}
