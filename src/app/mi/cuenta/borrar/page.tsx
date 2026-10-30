import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AlertCircle, Trash2 } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import {
  bajaPendiente,
  fechaDeBorradoSiSePideHoy,
  porQueNoSePuedeBorrar,
  turnosPorVenir,
} from '@/lib/cuenta/baja';
import { Aviso } from '@/components/aviso';
import { Button, buttonVariants } from '@/components/ui/button';
import { CabeceraMiembro } from '../../_components/cabecera-miembro';
import { pedirBaja } from './actions';

export const metadata: Metadata = { title: 'Borrar mi cuenta' };

/**
 * Borrar la cuenta. Lo exigen Apple (5.1.1(v)) y Google.
 *
 * Solo pide sesión, no iglesia: ver la cabecera de `actions.ts`. Por eso no usa
 * `requireIglesia()`, y la guarda es el `getUser()` de aquí mismo.
 */
export default async function BorrarCuentaPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/acceso?next=' + encodeURIComponent('/mi/cuenta/borrar'));

  if (await bajaPendiente(user.id)) redirect('/cuenta-en-baja');

  const { error } = await searchParams;
  const [impedimento, turnos] = await Promise.all([
    porQueNoSePuedeBorrar(user.id),
    turnosPorVenir(user.id),
  ]);

  const dia = new Intl.DateTimeFormat('es', {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(fechaDeBorradoSiSePideHoy());

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <CabeceraMiembro user={user} titulo="Borrar mi cuenta" volver="/mi/cuenta" />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-5 px-4 py-6 sm:px-5">
        {error && <Aviso>{error}</Aviso>}

        <h1 className="text-[22px] font-extrabold tracking-[-0.025em]">
          ¿Borrar tu cuenta?
        </h1>

        <ol className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
          <Paso cuando="Hoy">
            Se desactiva: se cierra tu sesión en todos tus dispositivos y dejas
            de entrar en tu iglesia.
            {turnos > 0 &&
              (turnos === 1
                ? ' Tu turno pendiente queda sin cubrir y avisamos a quien lleva tu equipo.'
                : ` Tus ${turnos} turnos pendientes quedan sin cubrir y avisamos a quien lleva tus equipos.`)}
          </Paso>
          <Paso cuando={`El ${dia}`}>
            Borramos tu cuenta, tu foto, lo que hayas publicado y comentado en
            la comunidad, y tus avisos. Ya no se puede recuperar.
          </Paso>
          <Paso cuando="Hasta entonces">
            Si cambias de idea, entra con tu correo y tu contraseña y la
            recuperas tal cual.
          </Paso>
        </ol>

        <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
          Tu ficha en la iglesia —tu nombre, tus datos de contacto, los equipos
          en los que has servido— es de la iglesia y la sigue llevando ella. Si
          quieres salir también de su fichero, pídeselo al pastor. Más detalle
          en la{' '}
          <Link href="/privacidad" className="font-semibold text-foreground underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>

        {impedimento ? (
          <div className="flex items-start gap-3 rounded-xl border border-border bg-surface p-4">
            <AlertCircle className="mt-0.5 size-5 flex-none text-badge-warning-fg" strokeWidth={1.8} />
            <p className="text-[14.5px] leading-relaxed">{impedimento}</p>
          </div>
        ) : (
          <form action={pedirBaja} className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[14px] font-bold">
                Escribe tu contraseña para confirmar
              </span>
              <input
                type="password"
                name="password"
                required
                autoComplete="current-password"
                className="h-12 w-full rounded-lg border border-input bg-surface-alt px-3.5 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              />
            </label>

            <Button type="submit" variant="destructive" size="lg" className="w-full">
              <Trash2 strokeWidth={1.8} />
              Borrar mi cuenta
            </Button>
          </form>
        )}

        <Link
          href="/mi/cuenta"
          className={buttonVariants({ variant: 'outline', size: 'lg' }) + ' w-full'}
        >
          No, quiero quedarme
        </Link>
      </main>
    </div>
  );
}

function Paso({ cuando, children }: { cuando: string; children: React.ReactNode }) {
  return (
    <li className="flex flex-col gap-1 border-b border-border px-4 py-3.5 last:border-b-0">
      <span className="text-[13px] font-bold uppercase tracking-[0.04em] text-muted-foreground">
        {cuando}
      </span>
      <span className="text-pretty text-[15px] leading-relaxed">{children}</span>
    </li>
  );
}
