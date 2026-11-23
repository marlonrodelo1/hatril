import type { ReactNode } from 'react';
import Link from 'next/link';
import { Ban, CheckCircle2 } from 'lucide-react';

import { Button, buttonVariants } from '@/components/ui/button';
import { bloquear } from '../actions';

/**
 * Lo que pinta «Denuncia enviada», sin consultar nada. Salió de
 * `../denuncia-enviada/page.tsx` el 20-nov para que la pinten igual la web y
 * la app empaquetada (`movil/`). El porqué, en esa página.
 */
export function VistaDenunciaEnviada({
  cabecera,
  autorId,
  nombre,
  yaBloqueado,
}: {
  cabecera: ReactNode;
  autorId: string | null;
  nombre: string | null;
  yaBloqueado: boolean;
}) {
  const corto = nombre?.split(' ')[0];
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {cabecera}

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
