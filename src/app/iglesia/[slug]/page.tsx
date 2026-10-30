import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ChevronLeft, Clock, Info, Mail, MapPin, Navigation, Phone } from 'lucide-react';

import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth/user-context';
import { solicitudDeUsuario } from '@/lib/solicitudes/consultas';
import { fichaDeIglesia } from '@/lib/iglesias/directorio';
import { iniciales } from '@/lib/format/iniciales';
import { buttonVariants } from '@/components/ui/button';
import { nombrePais } from '../../buscar/_components/fila-iglesia';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const iglesia = await fichaDeIglesia((await params).slug);
  return { title: iglesia?.nombre ?? 'Iglesia' };
}

/**
 * La ficha de una iglesia en la app, antes de pedir entrar.
 *
 * Más corta que su web (`/i/[slug]`): quien llega aquí desde la búsqueda quiere
 * saber si es la suya, dónde está y cuándo se reúne, y pedir entrar. Un solo
 * naranja, «Solicitar ser miembro», y nada que sugiera entrada directa: siempre
 * aprueba el pastor.
 *
 * TRES VARIANTES, Y NINGUNA ES UN ERROR
 * -------------------------------------
 *   - La iglesia no acepta solicitudes por la app: gestiona las altas en
 *     persona, y se dan su teléfono y su correo.
 *   - Quien mira ya es de otra iglesia, o tiene una solicitud pendiente: en
 *     Hatril se es de una sola, así que no hay botón de solicitar. La base lo
 *     admitiría —el unique es por pareja—; la regla la pone la aplicación.
 *   - Quien mira ya es de ESTA: a su muro.
 */
export default async function FichaIglesiaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const iglesia = await fichaDeIglesia((await params).slug);
  if (!iglesia) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [ctx, solicitud] = user
    ? await Promise.all([getCurrentUserContext(), solicitudDeUsuario(user.id)])
    : [null, null];

  const pendiente = solicitud?.estado === 'pendiente' ? solicitud : null;

  const horarios = [...iglesia.horarios].sort(
    (a, b) => Number(Boolean(b.destacado)) - Number(Boolean(a.destacado)),
  );
  const lugar = [iglesia.ciudad, nombrePais(iglesia.pais)].filter(Boolean).join(' · ');

  const destinoMapa =
    iglesia.latitud !== null && iglesia.longitud !== null
      ? `${iglesia.latitud},${iglesia.longitud}`
      : [iglesia.direccion, iglesia.ciudad].filter(Boolean).join(', ');

  return (
    <div className="flex min-h-dvh flex-col bg-background pt-[env(safe-area-inset-top)]">
      <header className="mx-auto flex w-full max-w-[560px] items-center px-2 pt-2">
        <Link
          href="/buscar"
          aria-label="Volver a buscar"
          className="flex size-11 items-center justify-center rounded-full text-foreground no-underline outline-none hover:bg-surface-active focus-visible:ring-3 focus-visible:ring-ring/20"
        >
          <ChevronLeft className="size-5" strokeWidth={1.9} />
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-6 px-5 pt-2 pb-8">
        <div className="flex items-center gap-4">
          {iglesia.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={iglesia.logoUrl}
              alt=""
              className="size-16 flex-none rounded-2xl border border-border bg-surface object-cover"
            />
          ) : (
            <span className="flex size-16 flex-none items-center justify-center rounded-2xl bg-accent text-[20px] font-bold text-accent-foreground">
              {iniciales(iglesia.nombre)}
            </span>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <h1 className="text-balance text-[24px] leading-tight font-extrabold tracking-[-0.025em]">
              {iglesia.nombre}
            </h1>
            <span className="text-[14.5px] text-muted-foreground">
              {[iglesia.denominacion, lugar].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>

        {iglesia.descripcion && (
          <p className="text-pretty text-[16px] leading-relaxed">{iglesia.descripcion}</p>
        )}

        {horarios.length > 0 && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
              Horarios
            </h2>
            <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
              {horarios.map((h, i) => (
                <li
                  key={i}
                  className={
                    'flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0 ' +
                    (h.destacado ? 'bg-accent' : '')
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <Clock
                      className={'size-[17px] flex-none ' + (h.destacado ? 'text-accent-foreground' : 'text-muted-foreground')}
                      strokeWidth={1.8}
                    />
                    <span className={'text-[15px] font-semibold ' + (h.destacado ? 'text-accent-foreground' : '')}>
                      {h.nombre}
                    </span>
                  </span>
                  <span className={'text-[14.5px] ' + (h.destacado ? 'font-semibold text-accent-foreground' : 'text-muted-foreground')}>
                    {h.dia} · {h.hora}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {(iglesia.direccion || iglesia.ciudad) && (
          <section className="flex flex-col gap-2">
            <h2 className="text-[13px] font-bold tracking-[0.04em] text-muted-foreground uppercase">
              Dónde estamos
            </h2>
            <div className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3">
              <MapPin className="size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
              <span className="flex min-w-0 flex-1 flex-col">
                {iglesia.direccion && <span className="text-[15px] font-semibold">{iglesia.direccion}</span>}
                {iglesia.ciudad && <span className="text-[13.5px] text-muted-foreground">{iglesia.ciudad}</span>}
              </span>
              {destinoMapa && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destinoMapa)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: 'outline', size: 'sm' })}
                >
                  <Navigation strokeWidth={1.8} />
                  Cómo llegar
                </a>
              )}
            </div>
          </section>
        )}

        <span className="flex-1" />

        {ctx?.iglesia.id === iglesia.id ? (
          <Link href="/mi" className={buttonVariants({ size: 'lg' }) + ' h-[52px] w-full'}>
            Ya eres de esta iglesia: entrar
          </Link>
        ) : ctx ? (
          <Bloque titulo={`Ya eres de ${ctx.iglesia.nombre}`}>
            En Hatril se es de una sola iglesia. Si quieres cambiarte, primero
            habla con tu pastor para salir de la tuya; después podrás pedir
            entrar aquí.
          </Bloque>
        ) : pendiente ? (
          <Bloque
            titulo={
              pendiente.iglesiaSlug === iglesia.slug
                ? 'Ya pediste entrar aquí'
                : `Tienes una solicitud pendiente en ${pendiente.iglesiaNombre}`
            }
            accion={
              <Link href="/mi" className={buttonVariants({ variant: 'outline' }) + ' self-start'}>
                Ver mi solicitud
              </Link>
            }
          >
            {pendiente.iglesiaSlug === iglesia.slug
              ? 'Tu solicitud está con el pastor. Te avisaremos cuando responda.'
              : 'Solo se puede ser de una iglesia. Para pedir entrar aquí, cancela antes esa solicitud.'}
          </Bloque>
        ) : !iglesia.aceptaSolicitudes ? (
          <Bloque
            titulo="Esta iglesia gestiona las altas en persona"
            accion={
              (iglesia.telefono || iglesia.email) && (
                <div className="flex flex-wrap gap-2">
                  {iglesia.telefono && (
                    <a href={`tel:${iglesia.telefono}`} className={buttonVariants({ variant: 'outline' })}>
                      <Phone strokeWidth={1.8} />
                      Llamar
                    </a>
                  )}
                  {iglesia.email && (
                    <a href={`mailto:${iglesia.email}`} className={buttonVariants({ variant: 'outline' })}>
                      <Mail strokeWidth={1.8} />
                      Escribir
                    </a>
                  )}
                </div>
              )
            }
          >
            Ven a un culto y pregunta por el equipo de acogida
            {iglesia.telefono || iglesia.email ? ', o escríbeles antes.' : '.'}
          </Bloque>
        ) : (
          <div className="flex flex-col gap-2.5">
            <Link
              href={`/solicitar/${iglesia.slug}`}
              className={buttonVariants({ size: 'lg' }) + ' h-[52px] w-full text-[16px]'}
            >
              Solicitar ser miembro
            </Link>
            <p className="text-center text-[13.5px] leading-snug text-muted-foreground">
              El pastor revisa cada solicitud y te avisamos cuando responda.
            </p>
          </div>
        )}

        {iglesia.webPublica && (
          <Link
            href={`/i/${iglesia.slug}`}
            className="self-center text-[14px] font-semibold text-foreground underline underline-offset-2"
          >
            Ver la web de la iglesia
          </Link>
        )}
      </main>
    </div>
  );
}

function Bloque({
  titulo,
  accion,
  children,
}: {
  titulo: string;
  accion?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start gap-3">
        <Info className="mt-0.5 size-5 flex-none text-muted-foreground" strokeWidth={1.8} />
        <div className="flex flex-col gap-1">
          <p className="text-[15.5px] font-bold">{titulo}</p>
          <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">{children}</p>
        </div>
      </div>
      {accion}
    </div>
  );
}
