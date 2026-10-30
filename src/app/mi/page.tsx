import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { Metadata } from 'next';
import { Check, ChevronRight, Clock, Search } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { getCurrentSuperAdmin } from '@/lib/auth/super-admin';
import { esDelEquipo, inicioDe } from '@/lib/auth/permisos';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { bajaPendiente } from '@/lib/cuenta/baja';
import { isNativeApp } from '@/lib/platform/is-native-app';
import { COOKIE_BIENVENIDA } from '@/lib/bienvenida';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraMiembro } from './_components/cabecera-miembro';
import { cancelarSolicitud } from '../solicitar/actions';

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
 * a alguien que sigue siendo `miembro`, o nombrarle colíder de un ministerio, y
 * esa persona tiene que poder entrar.
 *
 * Es también la ruta con la que arranca la app nativa (`appStartPath` en
 * capacitor.config.ts). Que redirija siempre no le estorba al WebView; el
 * porqué, y el caso raro en que sí, en la nota de ese fichero.
 */
export default async function MiPage({
  searchParams,
}: {
  searchParams: Promise<{ enviada?: string; cancelada?: string }>;
}) {
  const { enviada, cancelada } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // En la app, quien la abre sin sesión es casi siempre alguien que acaba de
  // descargarla: a la bienvenida, y a la presentación solo la primera vez. En
  // la web, `/mi` sin sesión es un enlace guardado: a identificarse.
  if (!user) {
    if (!(await isNativeApp())) redirect('/acceso?next=/mi');
    const vista = (await cookies()).get(COOKIE_BIENVENIDA)?.value === '1';
    redirect(vista ? '/empezar' : '/bienvenida');
  }

  const ctx = await getCurrentUserContext();

  // Quien lleva algo en la iglesia tiene su sitio en el panel, y en qué punto
  // del panel lo decide `inicioDe`: a quien solo lleva un ministerio, el suyo.
  // Aquí estaba escrito `/panel/hoy` a mano. No es el único sitio que lo
  // escribe: otros desvíos y el «Ir al panel» del menú de cuenta siguen
  // mandando ahí, y a quien solo lleva un ministerio le dejan en el resumen en
  // vez de en lo suyo. Antes de dar por hecho que un camino pasa por
  // `inicioDe`, busca la ruta.
  //
  // El `esDelEquipo` va delante y no sobra: para un miembro raso `inicioDe`
  // devuelve `/mi`, que es esta misma pantalla, y redirigirle ahí sería un
  // bucle.
  if (ctx && esDelEquipo(ctx)) redirect(inicioDe(ctx));

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

  // El super admin sin iglesia no está «esperando a que le acepten»: su sitio
  // es `/admin`. Aquí llega por los caminos que no pasan por el formulario de
  // acceso —el enlace de `/auth/confirm`, la app nativa que arranca en `/mi`—.
  if (await getCurrentSuperAdmin()) redirect('/admin');

  // Quien pidió borrar su cuenta tiene sus membresías en `baja`, así que llega
  // aquí sin iglesia. No está buscando una: está a tiempo de arrepentirse.
  if (await bajaPendiente(user.id)) redirect('/cuenta-en-baja');

  const solicitud = await solicitudDeUsuario(user.id);

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/*
       * Sin campana: aquí solo llega quien NO tiene congregación —con iglesia
       * activa esta pantalla redirige, al panel o al muro, más arriba—, y el
       * menú de cuenta se queda en «Cerrar sesión» solo. Lo decide la propia
       * cabecera al ver que no hay contexto de iglesia.
       */}
      <CabeceraMiembro user={user} titulo="Hatril" campana={false} marca />

      <main className="mx-auto flex w-full max-w-[620px] flex-col gap-6 px-4 py-12 sm:px-5">
        {enviada && (
          <Aviso tipo="ok">
            Solicitud enviada. Te avisamos en cuanto la revisen.
          </Aviso>
        )}

        {cancelada && !solicitud && (
          <Aviso tipo="ok">Solicitud cancelada. Puedes pedir entrar en otra iglesia.</Aviso>
        )}

        {/*
         * La pantalla «Solicitud enviada» del diseño de la bienvenida: es la
         * misma que se ve al abrir la app mientras se espera. Sin «activar
         * avisos»: los avisos al móvil no existen todavía, y no se promete lo
         * que no hay.
         */}
        {solicitud?.estado === 'pendiente' && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-balance text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
                Tu solicitud está con el pastor de {solicitud.iglesiaNombre}
              </h1>
              <p className="text-pretty text-[15.5px] leading-relaxed text-muted-foreground">
                Te avisaremos en cuanto te acepte. No tienes que hacer nada más.
              </p>
            </div>

            <ol className="flex flex-col rounded-xl border border-border bg-surface px-4 py-2">
              <Paso hecho titulo="Solicitud enviada" detalle={formatearFecha(solicitud.createdAt)} />
              <Paso actual titulo="El pastor la revisa" detalle="Ahora" />
              <Paso titulo="Entras en la comunidad" detalle="Cuando te acepte" ultimo />
            </ol>

            <p className="text-[14px] leading-relaxed text-muted-foreground">
              Si tienes prisa, lo más rápido es decírselo en persona el domingo.
            </p>

            <Link
              href={`/iglesia/${solicitud.iglesiaSlug}`}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 text-foreground no-underline hover:bg-surface-active"
            >
              <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <Clock className="size-5" strokeWidth={1.8} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-bold">
                  Mientras esperas, conoce {solicitud.iglesiaNombre}
                </span>
                <span className="text-[13px] text-muted-foreground">Horarios y dónde está</span>
              </span>
              <ChevronRight className="size-[18px] flex-none text-muted-foreground" strokeWidth={1.8} />
            </Link>

            <form action={cancelarSolicitud} className="self-center">
              <Button type="submit" variant="ghost" className="text-muted-foreground hover:text-foreground">
                Cancelar solicitud
              </Button>
            </form>
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

        {/* También sin iglesia: Apple y Google piden poder borrar toda cuenta
            que se pueda crear, y aquí hay cuentas que nunca llegan a entrar en
            ninguna. */}
        <Link
          href="/mi/cuenta/borrar"
          className="self-center text-[13.5px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Borrar mi cuenta
        </Link>
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

function Paso({
  titulo,
  detalle,
  hecho = false,
  actual = false,
  ultimo = false,
}: {
  titulo: string;
  detalle: string;
  hecho?: boolean;
  actual?: boolean;
  ultimo?: boolean;
}) {
  return (
    <li className="flex gap-3 py-2">
      <span className="flex flex-col items-center">
        <span
          className={
            'flex size-6 flex-none items-center justify-center rounded-full border ' +
            (hecho
              ? 'border-support bg-support text-white'
              : actual
                ? 'border-primary bg-accent'
                : 'border-border bg-surface')
          }
        >
          {hecho && <Check className="size-3.5" strokeWidth={2.4} />}
          {actual && <span className="size-2 rounded-full bg-primary" />}
        </span>
        {!ultimo && <span className="mt-1 w-px flex-1 bg-border" />}
      </span>
      <span className="flex flex-col pb-1">
        <span className={'text-[15px] ' + (hecho || actual ? 'font-bold' : 'text-muted-foreground')}>
          {titulo}
        </span>
        <span className="text-[13px] text-muted-foreground">{detalle}</span>
      </span>
    </li>
  );
}
