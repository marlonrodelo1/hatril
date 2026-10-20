import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import type { UserContext } from '@/lib/auth/user-context';
import { Aviso } from '@/components/aviso';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';

/**
 * El marco de cada pantalla de la zona del líder: la cabecera de `/mi`, el
 * ancho de `/mi` y los avisos de las actions.
 *
 * El mismo ancho de 620 que el muro, la agenda y la cuenta. Con otro, al pasar
 * de la pestaña «Agenda» a «Equipo» el contenido saltaría de sitio, que es lo
 * que `CabeceraMiembro` ya arregló una vez.
 *
 * Los avisos van arriba y siempre aquí, para que ninguna pantalla se olvide de
 * pintar el `?error=` con el que vuelve una action: sin él, un «no puedes
 * guardar en solo lectura» se queda en la URL y la persona cree que guardó.
 */
export function MarcoEquipo({
  ctx,
  titulo,
  subtitulo,
  volver,
  error,
  ok,
  children,
}: {
  ctx: UserContext;
  titulo: string;
  subtitulo?: string;
  volver?: string;
  error?: string;
  /** El texto de confirmación, ya resuelto desde `?guardado=`. */
  ok?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={ctx.user}
        titulo={titulo}
        subtitulo={subtitulo}
        volver={volver}
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-4 sm:px-5 sm:py-6">
        {error && <Aviso>{error}</Aviso>}
        {ok && <Aviso tipo="ok">{ok}</Aviso>}
        {children}
      </main>
    </div>
  );
}

/** El rótulo de sección de `/mi`: pequeño, en mayúsculas y gris. */
export function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Una fila que lleva a otra pantalla, con su flecha.
 *
 * El área entera es el enlace y mide al menos 48 px de alto: en el móvil se
 * pulsa con el pulgar, y una fila donde solo el título es pulsable obliga a
 * apuntar.
 */
export function FilaEnlace({
  href,
  children,
  derecha,
}: {
  href: string;
  children: React.ReactNode;
  /** Lo que va pegado a la flecha: una insignia, un número. */
  derecha?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-12 items-center gap-3 px-4 py-3 text-foreground no-underline hover:bg-surface-alt hover:no-underline"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</span>
      {derecha}
      <ChevronRight
        className="size-4 flex-none text-disabled-text"
        strokeWidth={1.9}
        aria-hidden
      />
    </Link>
  );
}

/** El contenedor de una lista de filas: un borde y separadores de 1 px. */
export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {children}
    </ul>
  );
}

/** La caja de «no hay nada» con su texto. */
export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-5 text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
