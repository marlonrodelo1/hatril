import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { Clock, Search } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { esDelEquipo } from '@/lib/auth/permisos';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from './_components/cabecera-miembro';

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
 * Y DESDE HOY ES ADEMÁS EL ÁREA DEL MIEMBRO
 * ------------------------------------------
 * Quien pertenece a una iglesia y no lleva nada en ella ya no aterriza en
 * `/panel`. Allí veía un menú de ocho secciones donde no podía pulsar casi nada,
 * con Miembros y Ministerios —el fichero de la congregación— en la primera
 * línea. Aquí ve lo suyo: sus equipos, lo que le viene encima y sus dos puertas.
 *
 * Quién va a cada sitio lo decide `esDelEquipo()`, que mira las capacidades
 * efectivas y no el nombre del rol: el pastor puede darle la caja o el devocional
 * a alguien que sigue siendo `miembro`, y esa persona tiene que poder entrar.
 *
 * Esta es la ruta que envuelve la app móvil de la v2.
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

  const ctx = await getCurrentUserContext();

  // Quien lleva algo en la iglesia tiene su sitio en el panel.
  if (ctx && esDelEquipo(ctx)) redirect('/panel/hoy');

  // Y quien pertenece pero no lleva nada, a su casa: el muro.
  //
  // La comunidad es lo primero que tiene que ver al abrir, porque es lo único
  // que cambia todos los días. El devocional, la agenda y su cuenta están a un
  // toque en las pestañas. `/mi` se queda como el desvío que decide a dónde va
  // cada quien, y por eso ya no pinta pantalla propia.
  //
  // El corte del consentimiento lo pone `/mi/comunidad`, igual que las otras
  // tres pestañas: aquí no hace falta duplicarlo para redirigir.
  if (ctx) redirect('/mi/comunidad');

  const solicitud = await solicitudDeUsuario(user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/*
       * Sin campana: aquí solo llega quien NO tiene congregación —con iglesia
       * activa esta pantalla redirige al panel, tres líneas más arriba—, y el
       * menú de cuenta se queda en «Cerrar sesión» solo. Lo decide la propia
       * cabecera al ver que no hay contexto de iglesia.
       */}
      <CabeceraMiembro user={user} titulo="Hatril" campana={false} />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-6 px-4 py-12 sm:px-5">
        {enviada && (
          <Aviso tipo="ok">
            Solicitud enviada. Te avisamos en cuanto la revisen.
          </Aviso>
        )}

        {solicitud?.estado === 'pendiente' && (
          <div className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-6">
            <span className="flex size-11 items-center justify-center rounded-full bg-badge-warning-bg text-badge-warning-fg">
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
