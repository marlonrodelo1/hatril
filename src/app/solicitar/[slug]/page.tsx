import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { iglesiaParaSolicitar } from '@/lib/iglesias/directorio';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { createClient } from '@/lib/supabase/server';
import { iniciales } from '@/lib/format/iniciales';
import { crearCuentaYSolicitar, solicitarIngreso } from '../actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS } from '@/lib/rgpd/consentimiento';
import { CasillaAsistencia } from '@/components/casilla-asistencia';
import { ReglaPassword } from './_components/regla-password';

export const metadata: Metadata = { title: 'Pedir entrar' };

/**
 * Pedir entrar en una iglesia.
 *
 * Sin sesión, el formulario lleva también la cuenta —correo y contraseña— y se
 * envía todo de una vez (`crearCuentaYSolicitar`). Con sesión, solo lo de la
 * solicitud. Es la pantalla «Cuenta» del diseño de la bienvenida: la cuenta se
 * pide aquí, al final, y no antes de dejar mirar.
 *
 * Lo obligatorio no lleva asterisco; lo opcional dice «(opcional)».
 */
export default async function SolicitarPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;

  const iglesia = await iglesiaParaSolicitar(slug);
  if (!iglesia) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Con sesión y con iglesia activa no hay nada que solicitar: esta persona ya
  // está dentro de alguna congregación. Y con una solicitud pendiente, a verla.
  if (user) {
    const ctx = await getCurrentUserContext();
    if (ctx) redirect('/mi');

    const solicitud = await solicitudDeUsuario(user.id);
    if (solicitud?.estado === 'pendiente') redirect('/mi');
  }

  // La ficha cuenta por qué no se puede: aquí no se repite.
  if (!iglesia.aceptaSolicitudes) redirect(`/iglesia/${slug}`);

  const nombreSugerido = (user?.user_metadata?.nombre as string | undefined) ?? '';
  const campoClase =
    'h-12 w-full rounded-lg border border-input bg-surface px-3.5 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)] pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
      <header className="mx-auto flex w-full max-w-[560px] items-center px-2 pt-2">
        <Link
          href={`/iglesia/${slug}`}
          aria-label="Volver a la ficha de la iglesia"
          className="flex size-11 items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <ChevronLeft className="size-5" strokeWidth={1.9} />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-5 pt-2">
        {/* A qué iglesia se pide entrar, siempre a la vista. */}
        <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
          {iglesia.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={iglesia.logoUrl} alt="" className="size-10 flex-none rounded-lg object-cover" />
          ) : (
            <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-accent text-[13px] font-bold text-accent-foreground">
              {iniciales(iglesia.nombre)}
            </span>
          )}
          <span className="flex min-w-0 flex-col">
            <span className="text-[12px] text-muted-foreground">Pides entrar en</span>
            <span className="truncate text-[15px] font-bold">
              {[iglesia.nombre, iglesia.ciudad].filter(Boolean).join(' · ')}
            </span>
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] leading-tight font-extrabold tracking-[-0.025em]">
            {user ? 'Tu solicitud' : 'Crea tu cuenta'}
          </h1>
          <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {user
              ? 'El pastor verá lo que escribas aquí y te avisaremos cuando responda.'
              : 'Con ella el pastor sabrá quién eres y podrás entrar cuando te acepte.'}
          </p>
        </div>

        {error && <Aviso>{error}</Aviso>}

        <form action={user ? solicitarIngreso : crearCuentaYSolicitar} className="flex flex-col gap-4">
          <input type="hidden" name="slug" value={slug} />

          <Campo etiqueta="Nombre completo" id="nombre">
            <input
              id="nombre"
              name="nombre"
              required
              maxLength={120}
              autoComplete="name"
              defaultValue={nombreSugerido}
              className={campoClase}
            />
          </Campo>

          {!user && (
            <Campo etiqueta="Correo electrónico" id="email">
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className={campoClase}
              />
            </Campo>
          )}

          <Campo
            etiqueta="Teléfono"
            id="telefono"
            ayuda="Solo para que tu iglesia pueda contactarte."
          >
            <div className="flex gap-2">
              <select
                name="prefijo"
                aria-label="Prefijo del país"
                defaultValue={iglesia.pais === 'ES' ? 'ES' : 'CO'}
                className="h-12 flex-none rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              >
                <option value="ES">ES +34</option>
                <option value="CO">CO +57</option>
              </select>
              <input
                id="telefono"
                name="telefono"
                type="tel"
                required
                maxLength={40}
                autoComplete="tel-national"
                className={campoClase}
              />
            </div>
          </Campo>

          {!user && (
            <Campo etiqueta="Contraseña" id="password">
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                aria-describedby="regla-password"
                className={campoClase}
              />
              <ReglaPassword idCampo="password" />
            </Campo>
          )}

          <Campo etiqueta="Dirección" id="direccion" opcional>
            <input
              id="direccion"
              name="direccion"
              maxLength={240}
              autoComplete="street-address"
              className={campoClase}
            />
          </Campo>

          <Campo etiqueta="Mensaje para el pastor" id="mensaje" opcional>
            <textarea
              id="mensaje"
              name="mensaje"
              rows={3}
              maxLength={600}
              placeholder="Vengo los domingos desde marzo, me presentó Marta."
              className="w-full rounded-lg border border-input bg-surface px-3.5 py-2.5 text-base leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
            />
          </Campo>

          {/* El mismo consentimiento del art. 9 que en el alta de iglesia:
              vincularse a una congregación es lo que revela la confesión
              religiosa, y da igual por qué puerta se entre. */}
          <label className="group/consentimiento flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface p-3.5 hover:bg-surface-active has-checked:border-primary has-checked:bg-accent">
            <input
              type="checkbox"
              name="consentimiento"
              required
              aria-label={TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}
              className="mt-0.5 size-[18px] flex-none accent-primary"
            />
            <span className="text-[13.5px] leading-snug text-muted-foreground">
              {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}{' '}
              <Link
                href="/privacidad"
                target="_blank"
                className="font-semibold group-hover/consentimiento:text-accent-foreground group-has-checked/consentimiento:text-accent-foreground"
              >
                Política de privacidad
              </Link>
              .
            </span>
          </label>

          {/*
           * La casilla de `/acepta`, y NO otra parecida: la versión que se
           * guarda con la solicitud es la de ese texto. Sin ella, aprobar dejaba
           * a la persona con la política vigente aceptada y sin esta casilla,
           * que es justo lo que `miembrosSinPermisoDeAsistencia` lee como «dijo
           * que no».
           */}
          <CasillaAsistencia
            consecuencia={
              <>
                Puedes unirte igual sin marcarla. Entonces no sales en las listas
                de asistencia ni de seguimiento de la iglesia, y si ya tenían
                algo apuntado de ti en ellas, se borra.
              </>
            }
          />

          <Button type="submit" size="lg" className="mt-1 h-[52px] w-full text-[16px]">
            Enviar solicitud
          </Button>

          <p className="text-center text-[13.5px] leading-snug text-muted-foreground">
            Hasta que el pastor lo apruebe no verás nada de la congregación, y
            ellos solo verán lo que has escrito aquí.
          </p>
        </form>

        {!user && (
          <p className="text-center text-[15px] text-muted-foreground">
            ¿Ya tienes cuenta?{' '}
            <Link
              href={`/acceso?next=${encodeURIComponent(`/solicitar/${slug}`)}`}
              className="font-semibold text-foreground underline underline-offset-2"
            >
              Entra
            </Link>
          </p>
        )}
      </main>
    </div>
  );
}

function Campo({
  etiqueta,
  id,
  opcional = false,
  ayuda,
  children,
}: {
  etiqueta: string;
  id: string;
  opcional?: boolean;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold">
        {etiqueta}
        {opcional && <span className="ml-1.5 font-normal text-muted-foreground">(opcional)</span>}
      </label>
      {children}
      {ayuda && <p className="text-[13px] leading-snug text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
