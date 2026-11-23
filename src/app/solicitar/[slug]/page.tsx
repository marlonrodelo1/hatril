import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';

import { iglesiaParaSolicitar } from '@/lib/iglesias/directorio';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { createClient } from '@/lib/supabase/server';
import { grupoDeLaInvitacion, solicitudPendienteEn } from '@/lib/grupos/invitacion';
import { misGrupos } from '@/lib/grupos/consultas';
import { crearCuentaYSolicitar, solicitarIngreso, sumarInvitacionASolicitud, unirseAGrupo } from '../actions';
import { PasosSolicitud } from './_components/pasos-solicitud';
import { AccesoSocial } from '@/app/(auth)/_components/acceso-social';
import { Permisos } from './_components/permisos';
import { Button, buttonVariants } from '@/components/ui/button';
import { Aviso } from '@/components/aviso';

export const metadata: Metadata = { title: 'Pedir entrar' };

/**
 * Pedir entrar en una iglesia.
 *
 * Sin sesión, el formulario lleva también la cuenta —correo y contraseña— y se
 * envía todo de una vez (`crearCuentaYSolicitar`). Con sesión, solo lo de la
 * solicitud. Es la pantalla «Cuenta» del diseño de la bienvenida: la cuenta se
 * pide aquí, al final, y no antes de dejar mirar.
 *
 * Desde el 17-nov va en pasos (pieza «Unirse» del rediseño): «Tus datos», «Tu
 * contraseña» y «Los permisos». Pide lo mismo que antes, en el mismo
 * formulario y a la misma action; el porqué y cómo funciona sin JavaScript,
 * en `_components/pasos-solicitud.tsx`.
 *
 * Lo obligatorio no lleva asterisco; lo opcional dice «opcional».
 *
 * EL ENLACE DE UNA CÉLULA
 * -----------------------
 * Trae `?grupo=<código>`. Si no vale —cerrada, de otra iglesia, tecleado mal—
 * se sigue como una solicitud normal: lo que se viene a hacer es entrar en la
 * iglesia, y eso no depende del grupo. Si vale, el formulario lo lleva, y dos
 * casos que sin él se mandaban a `/mi` sin decir nada tienen su pantalla:
 * quien ya es de esta iglesia, y quien ya pidió entrar y espera.
 */
export default async function SolicitarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; grupo?: string }>;
}) {
  const { slug } = await params;
  const { error, grupo: codigo } = await searchParams;
  const mensajeError = error;

  const iglesia = await iglesiaParaSolicitar(slug);
  if (!iglesia) notFound();

  const grupo = await grupoDeLaInvitacion(iglesia.id, codigo);
  // Para no perder la invitación al ir a identificarse y volver.
  const aqui = `/solicitar/${slug}${grupo ? `?grupo=${grupo.codigo}` : ''}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión y con iglesia activa no hay nada que solicitar: esta persona ya
  // está dentro de alguna congregación. Y con una solicitud pendiente, a verla.
  //
  // SALVO SI TRAE LA INVITACIÓN DE UN GRUPO DE AQUÍ
  // -----------------------------------------------
  // El enlace de una célula acaba en el grupo de WhatsApp de la célula, y casi
  // todos los que lo abren ya son de la iglesia. Mandarles a `/mi` sin decir
  // nada hacía creer al líder que habían entrado. Y a quien ya pidió entrar y
  // espera se le ofrece que su solicitud lleve también esta invitación.
  if (user) {
    const ctx = await getCurrentUserContext();
    if (ctx) {
      if (!grupo || ctx.iglesia.id !== iglesia.id) redirect('/mi');
      // Si ya va a ese grupo, tampoco se le manda a pedírselo a nadie: el enlace
      // llega igual a quien está dentro, que es casi todo el grupo de WhatsApp.
      const yaVa = (await misGrupos(ctx)).some((g) => g.grupoId === grupo.id);
      return (
        <Marco slug={slug} titulo={yaVa ? `Ya vas a ${grupo.nombre}` : `Entrar en ${grupo.nombre}`} error={mensajeError}>
          {yaVa ? (
            <>
              <p className="text-pretty text-body text-muted-foreground">
                Tú ya estás dentro: lo tuyo de {grupo.nombre} lo ves en la app, en Mi
                cuenta.
              </p>
              <Link href="/mi/cuenta" className={buttonVariants({ variant: 'outline' })}>
                Ir a la app
              </Link>
            </>
          ) : (
            // Desde el 23-nov entra él mismo: antes se le mandaba a pedírselo a
            // quien lleva la red. Lo del teléfono, antes de pulsar.
            <form action={unirseAGrupo} className="flex flex-col items-start gap-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="grupo" value={grupo.codigo} />
              <p className="text-pretty text-body text-muted-foreground">
                Ya eres de {iglesia.nombre}. Con este enlace entras en{' '}
                <strong className="font-semibold text-foreground">{grupo.nombre}</strong>: lo
                verás en Mi cuenta, con quién la lleva, cuándo se reúne y el tema de cada
                semana. Quien la lleva verá tu nombre y tu teléfono, para poder llamarte.
                Puedes salir cuando quieras.
              </p>
              <Button type="submit">Entrar en {grupo.nombre}</Button>
            </form>
          )}
        </Marco>
      );
    }

    const pendiente = grupo ? await solicitudPendienteEn(user.id, iglesia.id) : null;
    if (pendiente && grupo) {
      if (pendiente.conInvitacion) redirect('/mi');
      return (
        <Marco slug={slug} titulo={`Ya pediste unirte a ${iglesia.nombre}`} error={mensajeError}>
          <form action={sumarInvitacionASolicitud} className="flex flex-col items-start gap-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="grupo" value={grupo.codigo} />
            <p className="text-pretty text-body text-muted-foreground">
              Tu solicitud espera respuesta. Si quieres, llevará también la invitación
              de <strong className="font-semibold text-foreground">{grupo.nombre}</strong>,
              y al aprobarla entrarás en ese grupo si sigue abierto y con este enlace.
              Quien lo lleva verá tu nombre y tu teléfono, para poder llamarte.
            </p>
            <Button type="submit">Sí, entrar también en {grupo.nombre}</Button>
          </form>
        </Marco>
      );
    }

    const solicitud = await solicitudDeUsuario(user.id);
    if (solicitud?.estado === 'pendiente') redirect('/mi');
  }

  // La ficha cuenta por qué no se puede: aquí no se repite.
  if (!iglesia.aceptaSolicitudes) redirect(`/iglesia/${slug}`);

  const nombreSugerido = (user?.user_metadata?.nombre as string | undefined) ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      {/* `key` con el error: si la action vuelve con uno, los pasos empiezan
          de cero, como el formulario que React acaba de vaciar. */}
      <PasosSolicitud
        key={error ?? ''}
        slug={slug}
        nombreIglesia={iglesia.nombre}
        paisIglesia={iglesia.pais}
        conSesion={Boolean(user)}
        nombreSugerido={nombreSugerido}
        error={error}
        accion={user ? solicitarIngreso : crearCuentaYSolicitar}
        permisos={<Permisos />}
        invitacion={grupo ? { codigo: grupo.codigo, nombre: grupo.nombre } : undefined}
        accesoRapido={user ? undefined : <AccesoSocial next={aqui} vuelta="/acceso" />}
      />
    </div>
  );
}

/**
 * El marco de las dos pantallas de la invitación que no son el formulario:
 * la misma cabecera que los pasos, con la flecha a la ficha de la iglesia.
 */
function Marco({
  slug,
  titulo,
  error,
  children,
}: {
  slug: string;
  titulo: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-10 border-b border-border bg-surface pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 w-full max-w-[560px] items-center gap-1 px-2">
          <Link
            href={`/iglesia/${slug}`}
            aria-label="Volver a la ficha de la iglesia"
            className="flex size-11 flex-none items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/20"
          >
            <ChevronLeft className="size-5" strokeWidth={1.8} />
          </Link>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-5 px-5 pt-5">
        {error && <Aviso>{error}</Aviso>}
        <section className="flex flex-col items-start gap-4 rounded-xl border border-border bg-surface p-5">
          <h1 className="t-subtitulo">{titulo}</h1>
          {children}
        </section>
      </main>
    </div>
  );
}
