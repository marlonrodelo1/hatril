import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';

import { eventoPublico } from '@/lib/eventos/publica';
import { obtenerIglesiaPublica } from '@/lib/iglesias/publica';
import { TEXTO_CONSENTIMIENTO_EVENTO } from '@/lib/rgpd/consentimiento';
import { DATOS_RESPONSABLE } from '@/lib/legal/datos-responsable';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { MAX_ACOMPANANTES } from '@/app/panel/eventos/constantes';
import { DatosEvento, FechaEvento } from '../../_components/eventos-piezas';
import { EventosFormulario } from './_components/eventos-formulario';
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
 *
 * LAS MISMAS PIEZAS QUE LA TARJETA (rediseño de la zona 3, 17-nov)
 * ----------------------------------------------------------------
 * El bloque de la fecha junto al título y la lista de datos —cuándo, dónde y lo
 * que cuesta, con las instrucciones de pago dentro— salen de
 * `_components/eventos-piezas.tsx`, igual que en la portada y en el «listo».
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
        <div className="mx-auto flex max-w-[720px] items-center gap-3 px-4 py-3 sm:px-5">
          <Link
            href={`/i/${slug}#eventos`}
            aria-label={`Volver a ${iglesia.nombre}`}
            className="flex size-9 flex-none items-center justify-center rounded-full text-muted-foreground no-underline hover:bg-surface-active hover:text-foreground hover:no-underline"
          >
            <ArrowLeft className="size-[19px]" strokeWidth={1.8} />
          </Link>
          <span className="min-w-0 truncate text-body font-bold tracking-[-0.015em]">
            {iglesia.nombre}
          </span>
        </div>
      </header>

      <main className="mx-auto flex max-w-[720px] flex-col gap-6 px-4 py-8 sm:px-5 sm:py-10">
        <div className="flex items-center gap-4">
          <FechaEvento inicioEn={e.inicioEn} timezone={tz} grande />
          <h1 className="min-w-0 text-pretty text-[clamp(24px,5.5vw,36px)] font-extrabold leading-[1.1] tracking-[-0.03em]">
            {e.titulo}
          </h1>
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
          <div className="flex max-w-[62ch] flex-col gap-3 text-body leading-relaxed">
            {e.descripcion.split(/\n\s*\n/).map((parrafo, i) => (
              <p key={i} className="text-pretty">
                {parrafo}
              </p>
            ))}
          </div>
        )}

        <DatosEvento
          evento={e}
          timezone={tz}
          moneda={moneda}
          iglesiaNombre={iglesia.nombre}
          conPago
        />

        {/* ---------- Apuntarse ---------- */}
        {!e.inscripcionesAbiertas ? (
          <div className="flex flex-col gap-3">
            {error && <Aviso>{error}</Aviso>}
            <Aviso tipo="info">
              Las inscripciones están cerradas. Habla con la iglesia si quieres
              venir.
            </Aviso>
          </div>
        ) : (
          <EventosFormulario
            accion={inscribirse.bind(null, slug, id)}
            titulo={e.titulo}
            error={error}
            maxAcompanantes={MAX_ACOMPANANTES}
            consentimiento={
              <>
                {TEXTO_CONSENTIMIENTO_EVENTO(iglesia.nombre)}{' '}
                <Link href="/privacidad" target="_blank" rel="noopener noreferrer">
                  Más información sobre el tratamiento
                </Link>
                .
              </>
            }
            informacion={
              /* La primera capa del art. 13, y va AQUÍ y no detrás del enlace.
                 Quien se apunta a un concierto no abre una pestaña nueva para
                 bajar a la sección 3 de una política: si la información que
                 exige el art. 13 solo está allí, no se ha informado a nadie.
                 El enlace de arriba es la segunda capa, no la primera.

                 Y el responsable es la IGLESIA, no Hatril: aquí no hay
                 contrato con esta persona, solo su consentimiento. */
              <div className="flex flex-col gap-1 rounded-lg border border-border bg-surface-alt p-4 text-label leading-relaxed text-muted-foreground">
                <p>
                  <b className="font-semibold text-foreground">Responsable:</b>{' '}
                  {iglesia.nombre}
                  {iglesia.email ? `, ${iglesia.email}` : ''}
                  {iglesia.telefono ? ` · ${iglesia.telefono}` : ''}.
                </p>
                <p>
                  <b className="font-semibold text-foreground">Para qué:</b>{' '}
                  organizar este evento y poder avisarte si cambia o se cancela.
                  La dirección IP y el navegador se guardan con un solo fin:
                  poder demostrar que el permiso lo diste tú.
                </p>
                <p>
                  <b className="font-semibold text-foreground">Por qué se puede:</b>{' '}
                  por tu consentimiento explícito (art. 9.2.a del RGPD). Darlo es
                  voluntario; sin él no podemos apuntarte, y no pasa nada más.
                </p>
                <p>
                  <b className="font-semibold text-foreground">Quién más lo ve:</b>{' '}
                  nadie fuera de la iglesia, salvo Hatril y sus proveedores, que
                  solo prestan el servicio.
                </p>
                <p>
                  <b className="font-semibold text-foreground">Cuánto tiempo:</b>{' '}
                  como máximo 90 días desde que el evento termina.
                </p>
                <p>
                  <b className="font-semibold text-foreground">Tus derechos:</b>{' '}
                  acceder, rectificar, borrar y retirar este permiso cuando
                  quieras, escribiendo a la iglesia o a{' '}
                  <a href={`mailto:${DATOS_RESPONSABLE.email}`}>{DATOS_RESPONSABLE.email}</a>.
                  Retirarlo no afecta a lo hecho antes. Y puedes reclamar ante la
                  autoridad de protección de datos.
                </p>
              </div>
            }
          />
        )}
      </main>
    </div>
  );
}
