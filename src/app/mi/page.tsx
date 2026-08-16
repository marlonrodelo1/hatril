import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, Search } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { salir } from '@/app/(auth)/actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';

export const metadata: Metadata = { title: 'Mi cuenta' };

/**
 * Dónde aterriza quien tiene cuenta pero todavía no iglesia.
 *
 * Es el destino al que `requireIglesia()` manda a quien está esperando
 * aprobación. Sin esta pantalla, esa persona rebota entre el panel y la de
 * acceso sin entender por qué.
 *
 * Tres situaciones distintas, tres mensajes distintos:
 *
 *   - Solicitud PENDIENTE  → «está en revisión», con la fecha de envío.
 *   - Solicitud RECHAZADA  → se le dice, con el motivo si lo hay, y se le deja
 *                            buscar otra iglesia. No se le esconde el resultado
 *                            ni se le deja esperando para siempre.
 *   - Sin solicitud        → al directorio.
 *
 * Con el tiempo esta ruta será el área del miembro (lo que publica su iglesia,
 * su ficha, sus ministerios), que es la que envuelve la app móvil de la v2.
 */
export default async function MiPage({
  searchParams,
}: {
  searchParams: Promise<{ enviada?: string }>;
}) {
  const { enviada } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/acceso?next=/mi');

  // Con iglesia activa, esta pantalla no aplica: su sitio es el panel.
  const ctx = await getCurrentUserContext();
  if (ctx) redirect('/panel/hoy');

  const solicitud = await solicitudDeUsuario(user.id);
  const nombre =
    (user.user_metadata?.nombre as string | undefined) ??
    user.email?.split('@')[0] ??
    'Tu cuenta';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[560px] items-center gap-3 px-5 py-3.5">
          <Link
            href="/"
            className="text-[16px] font-extrabold tracking-[-0.02em] text-foreground no-underline hover:no-underline"
          >
            Hatril
          </Link>
          <span className="flex-1" />
          <span className="flex size-8 items-center justify-center rounded-full bg-muted text-[11.5px] font-bold text-muted-foreground">
            {iniciales(nombre)}
          </span>
          <form action={salir}>
            <Button type="submit" variant="ghost" size="sm">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 py-12">
        {enviada && (
          <Aviso tipo="ok">
            Solicitud enviada. Te avisamos en cuanto la revisen.
          </Aviso>
        )}

        {solicitud?.estado === 'pendiente' && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-[#F6EDD9] text-[#7E5F13]">
              <Clock className="size-5" strokeWidth={1.7} />
            </span>

            <div className="flex flex-col gap-2">
              <h1 className="t-titulo">Tu solicitud está en revisión</h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                Pediste unirte a <strong>{solicitud.iglesiaNombre}</strong>
                {solicitud.iglesiaCiudad && ` (${solicitud.iglesiaCiudad})`} el{' '}
                {formatearFecha(solicitud.createdAt)}. Alguien del equipo la
                revisará y, en cuanto la apruebe, aquí verás lo que publica tu
                iglesia.
              </p>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Si tienes prisa, lo más rápido es decírselo en persona el
                domingo.
              </p>
            </div>

            <Button
              variant="outline"
              render={<Link href={`/i/${solicitud.iglesiaSlug}`} />}
            >
              Ver su página
            </Button>
          </div>
        )}

        {solicitud?.estado === 'rechazada' && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <div className="flex flex-col gap-2">
              <h1 className="t-titulo">Tu solicitud no salió adelante</h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                {solicitud.iglesiaNombre} no aprobó tu solicitud.
                {solicitud.motivoRechazo
                  ? ` Te dejaron este mensaje: «${solicitud.motivoRechazo}»`
                  : ' No dejaron ningún motivo.'}
              </p>
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Suele ser un malentendido más que otra cosa. Habla con ellos y,
                si quieres, vuelve a solicitarlo.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                render={<Link href={`/solicitar/${solicitud.iglesiaSlug}`} />}
              >
                Volver a solicitarlo
              </Button>
              <Button variant="outline" render={<Link href="/iglesias" />}>
                Buscar otra iglesia
              </Button>
            </div>
          </div>
        )}

        {!solicitud && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <Search className="size-5" strokeWidth={1.7} />
            </span>

            <div className="flex flex-col gap-2">
              <h1 className="t-titulo">Todavía no estás en ninguna iglesia</h1>
              <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
                Busca tu congregación y pide unirte. Cuando alguien del equipo
                lo apruebe, verás aquí lo que publican.
              </p>
            </div>

            <Button render={<Link href="/iglesias" />}>
              Buscar mi iglesia
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

function formatearFecha(fecha: Date): string {
  return fecha.toLocaleDateString('es', {
    day: 'numeric',
    month: 'long',
  });
}
