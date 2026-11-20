import type { ReactNode } from 'react';
import { Lock } from 'lucide-react';

import { Logo } from '@/components/marca/logo';
import { WEB_URL } from '@movil/lib/entorno';

/**
 * El marco de las pantallas de acceso: la columna del teléfono de
 * `src/app/(auth)/layout.tsx`, sin la de marca, que en la web solo sale desde
 * `lg`. El logo anclado arriba, el formulario y el pie con lo legal.
 *
 * La privacidad y los términos se abren fuera, en el navegador (un enlace con
 * `target="_blank"`, que Capacitor entrega al sistema): son páginas
 * de la web y no tiene sentido copiarlas en el binario, donde se quedarían
 * atrás en cuanto cambiara la política.
 */
export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background pt-[calc(3.5rem+env(safe-area-inset-top))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] pl-[max(1.25rem,env(safe-area-inset-left))]">
      <main className="mx-auto flex w-full max-w-[400px] flex-col gap-7">
        <div className="flex justify-center">
          <Logo variante="simbolo" tamano={56} />
        </div>
        {children}
      </main>

      <footer className="mx-auto mt-auto flex w-full max-w-[400px] flex-col items-center gap-2.5 pt-12 text-label text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <Lock className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
          Datos cifrados y alojados en la Unión Europea
        </p>
        <nav aria-label="Legal" className="flex items-center gap-1">
          <a
            href={`${WEB_URL}/privacidad`}
            target="_blank"
            rel="noopener"
            className="rounded-sm px-2 py-1 text-muted-foreground no-underline outline-offset-2 hover:text-foreground hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Privacidad
          </a>
          <span aria-hidden>·</span>
          <a
            href={`${WEB_URL}/terminos`}
            target="_blank"
            rel="noopener"
            className="rounded-sm px-2 py-1 text-muted-foreground no-underline outline-offset-2 hover:text-foreground hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            Términos
          </a>
        </nav>
      </footer>
    </div>
  );
}
