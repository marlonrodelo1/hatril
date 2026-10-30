import Link from 'next/link';
import type { Metadata } from 'next';
import { Ban, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { exigirConsentimientoAlDia } from '@/lib/rgpd/consultas';
import { misBloqueos, nombreDeMiembro } from '@/lib/comunidad/moderacion';
import { Button, buttonVariants } from '@/components/ui/button';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { bloquear } from '../actions';

export const metadata: Metadata = { title: 'Denuncia enviada' };

/**
 * Lo que se ve después de denunciar.
 *
 * Página y no un aviso en el muro porque aquí se ofrece el paso siguiente
 * —bloquear a esa persona—, y un aviso verde que se va al recargar no deja
 * sitio para eso.
 *
 * El `?autor=` es el id de una ficha y nada más: el nombre se resuelve por
 * `withUser`, así que un id de otra iglesia no pinta nada.
 */
export default async function DenunciaEnviadaPage({
  searchParams,
}: {
  searchParams: Promise<{ autor?: string }>;
}) {
  const ctx = await requireIglesia();
  await exigirConsentimientoAlDia(ctx);

  const { autor } = await searchParams;
  const autorId = z.uuid().safeParse(autor).success ? autor! : null;

  const [nombre, bloqueos] = await Promise.all([
    autorId ? nombreDeMiembro(ctx, autorId) : Promise.resolve(null),
    misBloqueos(ctx),
  ]);
  const yaBloqueado = bloqueos.some((b) => b.miembroId === autorId);
  const corto = nombre?.split(' ')[0];

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro
        user={ctx.user}
        titulo="Comunidad"
        subtitulo={ctx.iglesia.nombre}
        volver="/mi/comunidad"
      />

      <main className="mx-auto flex w-full max-w-[620px] flex-1 flex-col gap-6 px-4 py-8 sm:px-5">
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-12 items-center justify-center rounded-full bg-badge-success-bg text-badge-success-fg">
            <CheckCircle2 className="size-6" strokeWidth={1.8} />
          </span>
          <h1 className="text-[22px] font-extrabold tracking-[-0.025em]">
            El pastor ya tiene tu denuncia
          </h1>
          <p className="text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
            La revisará y decidirá qué hacer. Mientras, hemos ocultado eso para
            ti. Gracias por cuidar la comunidad.
          </p>
        </div>

        {autorId && nombre && !yaBloqueado && (
          <form
            action={bloquear.bind(null, autorId)}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4"
          >
            <p className="text-[15px] font-bold">
              ¿Prefieres no ver nada más de {corto}?
            </p>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Si le bloqueas, dejarás de ver lo que publica y comenta. {corto} no
              se entera, y puedes deshacerlo desde Mi cuenta.
            </p>
            <Button type="submit" variant="secondary" className="self-start">
              <Ban strokeWidth={1.8} />
              Bloquear a {corto}
            </Button>
          </form>
        )}

        <Link
          href="/mi/comunidad"
          className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' w-full'}
        >
          Volver a la comunidad
        </Link>
      </main>
    </div>
  );
}
