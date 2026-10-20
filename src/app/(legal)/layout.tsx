import Link from 'next/link';

import { Logo } from '@/components/marca/logo';

/**
 * Marco de las páginas legales.
 *
 * Columna estrecha (65 caracteres por línea, más o menos) porque son textos
 * largos que alguien va a leer de verdad antes de decidir si confía en meter
 * aquí los datos de su congregación. A ancho completo no se leen.
 */
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[760px] items-center gap-4 px-5 py-3.5 md:px-8">
          <Link
            href="/"
            aria-label="Hatril, ir a la portada"
            className="rounded-sm no-underline outline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-ring"
          >
            <Logo variante="logotipo" tamano={22} />
          </Link>
          <span className="flex-1" />
          <Link
            href="/iglesias"
            className="text-[14px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            Buscar mi iglesia
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[760px] px-5 py-12 md:px-8 md:py-16">
        {children}
      </main>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-[760px] flex-wrap items-center gap-x-6 gap-y-2 px-5 py-8 text-[13.5px] text-muted-foreground md:px-8">
          <Link href="/privacidad" className="no-underline hover:underline">
            Privacidad
          </Link>
          <Link href="/terminos" className="no-underline hover:underline">
            Términos
          </Link>
          <span className="flex-1" />
          <Logo variante="logotipo" tamano={18} />
        </div>
      </footer>
    </div>
  );
}
