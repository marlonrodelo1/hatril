import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { listarMuro } from '@/lib/comunidad/consultas';
import { iniciales } from '@/lib/format/iniciales';
import { salir } from '@/app/(auth)/actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Publicador } from './_components/publicador';
import { Publicacion } from './_components/publicacion';

export const metadata: Metadata = { title: 'Comunidad' };

/**
 * El muro de la congregación.
 *
 * PUERTAS ADENTRO
 * ---------------
 * `requireIglesia()` echa a quien no tiene membresía ACTIVA: sin sesión, a
 * identificarse; con sesión y solicitud pendiente, a `/mi`, que le cuenta en qué
 * punto está. Aquí no entra nadie de fuera de la congregación, y las policies de
 * la `0015` lo garantizan aunque este guard se cayera.
 *
 * POR QUÉ NO ESTÁ EN EL PANEL
 * ---------------------------
 * El panel es la herramienta de quien administra la iglesia —fichero de
 * miembros, ministerios, ajustes— y la mayoría de la congregación no entra ahí
 * ni tiene por qué. El muro es de todos, así que vive en el área del miembro.
 *
 * `dynamic` porque esto cambia cada minuto y cada persona ve una cosa distinta:
 * sus «me gusta», sus publicaciones, sus botones de borrar. Cachearlo sería
 * enseñarle a alguien el muro tal y como lo ve otro.
 */
export const dynamic = 'force-dynamic';

export default async function ComunidadPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const ctx = await requireIglesia();
  const muro = await listarMuro(ctx);

  const nombre =
    (ctx.user.user_metadata?.nombre as string | undefined) ??
    ctx.user.email?.split('@')[0] ??
    'Tu cuenta';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="sticky top-0 z-20 border-b border-border bg-surface supports-[backdrop-filter]:bg-surface/80 supports-[backdrop-filter]:backdrop-blur-xl">
        <div className="mx-auto flex max-w-[620px] items-center gap-3 px-4 py-3 sm:px-5">
          <Link
            href="/mi"
            aria-label="Volver"
            className="flex size-9 flex-none items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-background hover:text-foreground hover:no-underline"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>

          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[15.5px] font-extrabold leading-tight tracking-[-0.02em]">
              Comunidad
            </span>
            <span className="truncate text-[12.5px] leading-tight text-muted-foreground">
              {ctx.iglesia.nombre}
            </span>
          </span>

          <span className="flex-1" />

          <span className="flex size-8 flex-none items-center justify-center rounded-full bg-muted text-[11.5px] font-bold text-muted-foreground">
            {iniciales(nombre)}
          </span>

          <form action={salir}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-4 px-4 py-5 sm:px-5 sm:py-6">
        {error && <Aviso tipo="error">{error}</Aviso>}

        <Publicador nombre={nombre} />

        {muro.length === 0 ? (
          /* Un muro vacío no es un error, es el primer día. Se dice así en vez
             de dejar la pantalla en blanco. */
          <div className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface p-6">
            <h2 className="text-[17px] font-bold tracking-[-0.02em]">
              Todavía no hay nada por aquí
            </h2>
            <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
              Esto lo ve solo la gente de {ctx.iglesia.nombre}. Una foto del
              domingo o una petición de oración son buenas maneras de empezar.
            </p>
          </div>
        ) : (
          muro.map((p) => (
            <Publicacion key={p.id} publicacion={p} puedeModerar={ctx.rol === 'pastor'} />
          ))
        )}

        <p className="px-1 pt-2 text-[12.5px] leading-relaxed text-muted-foreground">
          Lo que se publica aquí no sale en la web de la iglesia ni lo ve nadie
          de fuera. Si subes una foto donde salen otras personas, pídeles
          permiso antes.
        </p>
      </main>
    </div>
  );
}
