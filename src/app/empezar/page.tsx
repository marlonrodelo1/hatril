import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Church, ChevronRight, MapPin } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { Logo } from '@/components/marca/logo';

export const metadata: Metadata = { title: 'Empezar' };

/**
 * «¿Ya eres de una iglesia o estás buscando una?»
 *
 * Las dos respuestas llevan a buscar, por caminos distintos: quien ya es de
 * una sabe su nombre; quien busca quiere ver qué hay cerca. Ninguna pide la
 * cuenta todavía: se pide al final, al solicitar entrar, que es lo que pide
 * Apple y lo que hace que alguien llegue hasta ahí.
 */
export default async function EmpezarPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/mi');

  return (
    <div className="flex min-h-dvh flex-col bg-background px-6 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col">
        <Logo variante="logotipo" tamano={26} />

        <div className="flex flex-col gap-3 pt-14 pb-8">
          <h1 className="text-balance text-[30px] leading-[1.12] font-extrabold tracking-[-0.025em]">
            ¿Ya eres de una iglesia o estás buscando una?
          </h1>
          <p className="text-[16px] leading-relaxed text-muted-foreground">
            Así te llevamos por el camino corto.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Opcion
            href="/buscar"
            icono={<Church strokeWidth={1.8} />}
            titulo="Ya soy de una iglesia"
            detalle="Búscala por su nombre y pide entrar."
          />
          <Opcion
            href="/buscar/cerca"
            icono={<MapPin strokeWidth={1.8} />}
            titulo="Estoy buscando iglesia"
            detalle="Mira las que hay cerca de ti, sin compromiso."
          />
        </div>

        <span className="flex-1" />

        <p className="pt-8 text-center text-[15px] text-muted-foreground">
          ¿Ya tienes cuenta?{' '}
          <Link href="/acceso?next=/mi" className="font-semibold text-foreground underline underline-offset-2">
            Entra
          </Link>
        </p>
      </div>
    </div>
  );
}

function Opcion({
  href,
  icono,
  titulo,
  detalle,
}: {
  href: string;
  icono: React.ReactNode;
  titulo: string;
  detalle: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
    >
      <span className="flex size-12 flex-none items-center justify-center rounded-xl bg-accent text-accent-foreground [&_svg]:size-6">
        {icono}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[16.5px] font-bold tracking-[-0.015em]">{titulo}</span>
        <span className="text-[14px] leading-snug text-muted-foreground">{detalle}</span>
      </span>
      <ChevronRight className="size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
    </Link>
  );
}
