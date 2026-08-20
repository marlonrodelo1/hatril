import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft, CalendarDays, ExternalLink, MapPin } from 'lucide-react';

import { eventoPublico } from '@/lib/eventos/publica';
import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import { TEXTO_CONSENTIMIENTO_EVENTO } from '@/lib/rgpd/consentimiento';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_ACOMPANANTES } from '@/app/panel/eventos/constantes';
import { inscribirse } from './actions';

/**
 * La página de un evento, con su formulario para apuntarse.
 *
 * `force-dynamic` Y NO `revalidate`
 * ---------------------------------
 * El resto de `/i/[slug]` va con ISR de 60 segundos, y aquí no vale: esta página
 * enseña errores que vienen por query string después de enviar el formulario, y
 * una versión cacheada los serviría a quien no ha enviado nada.
 *
 * Lo que NO cambia con esto: aquí tampoco se enseña cuántas plazas quedan. Ni
 * cifra, ni «completo», ni un botón que desaparezca. Con cualquiera de las tres
 * se averigua si una persona concreta está apuntada —se ocupan las plazas menos
 * una, se prueba con su correo y se mira si el número se mueve—, y eso es dato
 * del art. 9 por inferencia. El rechazo por aforo se entera al enviar.
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const e = await eventoPublico(slug, id);
  if (!e) return { title: 'Evento' };

  return {
    title: { absolute: e.titulo },
    description: e.descripcion ?? undefined,
    openGraph: {
      title: e.titulo,
      description: e.descripcion ?? undefined,
      type: 'website',
      images: e.imagenUrl ? [e.imagenUrl] : undefined,
    },
  };
}

export default async function EventoPublicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug, id } = await params;
  const { error } = await searchParams;

  const e = await eventoPublico(slug, id);
  if (!e) notFound();

  const iglesia = await obtenerIglesiaPublica(slug);
  if (!iglesia) notFound();

  const moneda = e.moneda as Moneda;
  const tz = iglesia.timezone;

  return (
    <div className="min-h-dvh bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-4 sm:px-5">
          <Link
            href={`/i/${slug}`}
            aria-label={`Volver a ${iglesia.nombre}`}
            className="flex size-9 flex-none items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-background hover:text-foreground hover:no-underline"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>
          <span className="text-[14.5px] font-bold tracking-[-0.015em]">
            {iglesia.nombre}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[720px] flex-col gap-8 px-4 py-10 sm:px-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-[clamp(26px,6vw,38px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            {e.titulo}
          </h1>

          <div className="flex flex-col gap-1.5 text-[15px] text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <CalendarDays className="size-[18px] flex-none" strokeWidth={1.7} />
              <span className="first-letter:uppercase">
                {formatearInstante(e.inicioEn, tz, { conAnio: true })}
              </span>
            </span>
            {e.lugar && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="size-[18px] flex-none" strokeWidth={1.7} />
                {e.lugar}
              </span>
            )}
          </div>

          {e.precio && (
            <p className="text-[19px] font-bold tracking-[-0.02em]">
              {formatearDinero(e.precio, moneda)}
            </p>
          )}
        </div>

        {e.imagenUrl && (
          // `<img>` y no `next/image`: la URL viene de Storage y ya está
          // optimizada al subirla; pasar por el optimizador aquí solo añade un
          // salto.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.imagenUrl}
            alt=""
            className="w-full rounded-xl border border-border object-cover"
          />
        )}

        {e.descripcion && (
          <div className="flex flex-col gap-3 text-[16px] leading-relaxed">
            {e.descripcion.split(/\n\s*\n/).map((parrafo, i) => (
              <p key={i}>{parrafo}</p>
            ))}
          </div>
        )}

        {/* ---------- Cómo pagar ---------- */}
        {(e.enlacePago || e.pagoInstrucciones) && (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
            <h2 className="t-subtitulo">Cómo pagar</h2>

            {e.enlacePago && e.enlacePagoHost && (
              <div className="flex flex-col gap-1.5">
                <Button
                  variant="secondary"
                  className="w-fit"
                  render={
                    <a
                      href={e.enlacePago}
                      target="_blank"
                      // `nofollow` además de lo de siempre: este enlace lo pone
                      // la iglesia y no tiene por qué transmitir reputación.
                      rel="noopener noreferrer nofollow"
                    />
                  }
                >
                  <ExternalLink strokeWidth={1.8} />
                  Pagar la inscripción
                </Button>
                {/* El host, delante y en texto. Es la única mitad de esta
                    protección que ve quien va a pulsar: el pastor vio la
                    dirección entera al pegarla, aquí solo se ve el botón. Lo
                    escribió el servidor con `new URL().hostname` y un CHECK de
                    la base impide que contradiga a la URL. */}
                <p className="t-label text-muted-foreground">
                  Te lleva a <span className="font-bold">{e.enlacePagoHost}</span>
                </p>
              </div>
            )}

            {e.pagoInstrucciones && (
              // Como TEXTO y nunca dentro de un `href`: aquí van bizums,
              // teléfonos de Nequi y números de cuenta, que no son direcciones.
              <p className="whitespace-pre-line text-[15px]">
                {e.pagoInstrucciones}
              </p>
            )}

            {/* La misma frase que la ventana de donativos, palabra por palabra.
                En cuanto una página dice «Inscríbete · 50.000», quien la lee
                puede creer razonablemente que el comerciante somos nosotros. */}
            <p className="t-label text-muted-foreground">
              Hatril no cobra ni intermedia: el pago va directamente a{' '}
              {iglesia.nombre}.
            </p>
          </section>
        )}

        {/* ---------- Apuntarse ---------- */}
        <section
          id="apuntarse"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
        >
          <div className="flex flex-col gap-1">
            <h2 className="t-subtitulo">Apuntarse</h2>
            <p className="text-[13.5px] text-muted-foreground">
              No hace falta tener cuenta.
            </p>
          </div>

          {error && <Aviso>{error}</Aviso>}

          {!e.inscripcionesAbiertas ? (
            <p className="text-[15px] text-muted-foreground">
              Las inscripciones están cerradas. Habla con la iglesia si quieres
              venir.
            </p>
          ) : (
            <form
              action={inscribirse.bind(null, slug, id)}
              className="flex flex-col gap-4"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="nombre">Tu nombre</Label>
                  <Input id="nombre" name="nombre" required maxLength={120} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="email">Tu correo</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    required
                    maxLength={200}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="telefono">
                    Teléfono
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input id="telefono" name="telefono" type="tel" maxLength={32} />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="acompanantes">
                    ¿Vienes con alguien?
                    <span className="ml-1.5 font-normal text-muted-foreground">
                      (opcional)
                    </span>
                  </Label>
                  <Input
                    id="acompanantes"
                    name="acompanantes"
                    type="text"
                    inputMode="numeric"
                    maxLength={2}
                    placeholder="0"
                  />
                  <p className="t-label text-muted-foreground">
                    Cuántas personas más, hasta {MAX_ACOMPANANTES}.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nota">
                  ¿Quieres decirles algo?
                  <span className="ml-1.5 font-normal text-muted-foreground">
                    (opcional)
                  </span>
                </Label>
                <textarea
                  id="nota"
                  name="nota"
                  rows={2}
                  maxLength={500}
                  className="rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[15px] outline-none focus-visible:ring-[3px] focus-visible:ring-primary/16"
                />
              </div>

              {/* Casilla NATIVA, no la de shadcn. La de Radix guarda el valor en
                  estado de React y necesita un input oculto para que viaje en el
                  envío; para el dato del art. 9, cuanto menos intermediario
                  mejor. Está estilizada en `globals.css`. */}
              <label className="flex items-start gap-2.5 text-[14px] leading-relaxed">
                <input
                  type="checkbox"
                  name="consentimiento"
                  required
                  className="mt-0.5 flex-none"
                />
                <span>
                  {TEXTO_CONSENTIMIENTO_EVENTO}{' '}
                  <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                    Cómo se tratan tus datos
                  </Link>
                  .
                </span>
              </label>

              <Button type="submit" className="w-fit">
                Apuntarme
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
