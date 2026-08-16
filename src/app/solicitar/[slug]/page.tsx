import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { ChevronLeft } from 'lucide-react';

import { iglesiaParaSolicitar } from '@/lib/iglesias/directorio';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { createClient } from '@/lib/supabase/server';
import { iniciales } from '@/lib/format/iniciales';
import { solicitarIngreso } from '../actions';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS } from '@/lib/rgpd/consentimiento';

export const metadata: Metadata = { title: 'Pedir unirme' };

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
  // está dentro de alguna congregación.
  if (user) {
    const ctx = await getCurrentUserContext();
    if (ctx) redirect('/panel/hoy');

    const solicitud = await solicitudDeUsuario(user.id);
    if (solicitud) redirect('/mi');
  }

  const nombreSugerido =
    (user?.user_metadata?.nombre as string | undefined) ?? '';

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[560px] items-center gap-4 px-5 py-3.5">
          <Link
            href="/iglesias"
            className="inline-flex items-center gap-1 text-[13.5px] font-medium text-muted-foreground no-underline hover:text-foreground hover:no-underline"
          >
            <ChevronLeft className="size-4" strokeWidth={1.8} />
            Directorio
          </Link>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-col gap-7 px-5 py-10">
        <div className="flex items-center gap-4">
          <span className="flex size-14 flex-none items-center justify-center rounded-xl bg-accent text-[17px] font-bold text-accent-foreground">
            {iniciales(iglesia.nombre)}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em]">
              {iglesia.nombre}
            </h1>
            {iglesia.ciudad && (
              <span className="text-[14px] text-muted-foreground">
                {iglesia.ciudad}
              </span>
            )}
          </div>
        </div>

        {error && <Aviso>{error}</Aviso>}

        {!iglesia.aceptaSolicitudes ? (
          <Aviso>
            Esta iglesia no está aceptando solicitudes ahora mismo. Ponte en
            contacto con ellos directamente y te dirán cómo unirte.
          </Aviso>
        ) : !user ? (
          /*
           * Sin sesión no se puede solicitar. Es lo que impide que lluevan
           * solicitudes falsas y lo que da a la iglesia una persona real a la
           * que aprobar.
           *
           * Se ofrecen las dos puertas por separado, y con la advertencia de
           * cuál NO es la suya: `/registro` crea una iglesia entera, y quien
           * quiere unirse a la suya acabaría fundando una vacía sin darse
           * cuenta.
           */
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
            <div className="flex flex-col gap-1.5">
              <h2 className="t-subtitulo">Necesitas una cuenta</h2>
              <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
                Es gratis y solo sirve para que {iglesia.nombre} sepa quién eres
                al aprobar tu solicitud.
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Button
                render={
                  <Link
                    href={`/crear-cuenta?next=${encodeURIComponent(`/solicitar/${slug}`)}`}
                  />
                }
              >
                Crear mi cuenta
              </Button>
              <Button
                variant="outline"
                render={
                  <Link
                    href={`/acceso?next=${encodeURIComponent(`/solicitar/${slug}`)}`}
                  />
                }
              >
                Ya tengo cuenta
              </Button>
            </div>
          </div>
        ) : (
          <form
            action={solicitarIngreso}
            className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
          >
            <input type="hidden" name="slug" value={slug} />

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nombre">Cómo te llamas</Label>
              <Input
                id="nombre"
                name="nombre"
                required
                autoFocus
                maxLength={120}
                defaultValue={nombreSugerido}
                placeholder="Nombre y apellidos"
              />
              <p className="t-label text-muted-foreground">
                Como te conocen en la iglesia, para que sepan quién eres.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="telefono">
                Teléfono
                <span className="ml-1.5 font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <Input id="telefono" name="telefono" type="tel" maxLength={40} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mensaje">
                Cuéntales algo
                <span className="ml-1.5 font-normal text-muted-foreground">
                  (opcional)
                </span>
              </Label>
              <textarea
                id="mensaje"
                name="mensaje"
                rows={3}
                maxLength={600}
                placeholder="Vengo los domingos desde marzo, me presentó Marta."
                className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] leading-relaxed outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
              />
            </div>

            {/* El mismo consentimiento del art. 9 que en el alta de iglesia:
                vincularse a una congregación es lo que revela la confesión
                religiosa, y da igual por qué puerta se entre. */}
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-surface-alt p-3.5">
              <input
                type="checkbox"
                name="consentimiento"
                required
                className="mt-0.5"
              />
              <span className="text-[13.5px] leading-snug text-muted-foreground">
                {TEXTO_CONSENTIMIENTO_DATOS_RELIGIOSOS}{' '}
                <Link href="/privacidad" target="_blank" className="font-semibold">
                  Leer la política de privacidad
                </Link>
                .
              </span>
            </label>

            <Button type="submit" className="mt-1 w-fit">
              Enviar la solicitud
            </Button>

            <p className="text-[13px] leading-snug text-muted-foreground">
              Hasta que alguien de la iglesia lo apruebe no verás nada de la
              congregación, y ellos solo verán lo que has escrito aquí.
            </p>
          </form>
        )}
      </main>
    </div>
  );
}
