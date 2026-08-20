import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';

import type { EventoPublico } from '@/lib/eventos/publica';
import { formatearInstante } from '@/lib/fecha/zona';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Button } from '@/components/ui/button';

/**
 * Lo que la iglesia tiene organizado, en la web pública.
 *
 * NI UNA CIFRA DE PLAZAS, Y ES LA DECISIÓN QUE DEFINE ESTE COMPONENTE
 * -------------------------------------------------------------------
 * Ni «quedan 3», ni «completo», ni un botón que desaparezca cuando se llena.
 * Con cualquiera de las tres se averigua si una persona concreta está apuntada:
 * se ocupan todas las plazas menos una, se prueba con su correo y se mira si el
 * número se mueve. Saber que alguien va a un acto de una congregación es
 * confesión religiosa por inferencia, art. 9 del RGPD.
 *
 * Por eso `eventosPublicos()` no consulta `evento_inscripciones` ni para
 * contar. Si una iglesia quiere avisar de que quedan pocas plazas, que lo
 * escriba en la descripción: un texto suyo no se puede sondear.
 *
 * Server Component: no hay estado, solo enlaces.
 */
export function EventosIglesia({
  eventos,
  slug,
  timezone,
  moneda,
}: {
  eventos: EventoPublico[];
  slug: string;
  timezone: string;
  moneda: Moneda;
}) {
  return (
    <ul className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))]">
      {eventos.map((e) => (
        <li key={e.id} className="flex">
          <article className="flex w-full flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {e.imagenUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.imagenUrl}
                alt=""
                className="h-[160px] w-full border-b border-border object-cover"
              />
            )}

            <div className="flex flex-1 flex-col gap-3 p-5">
              <div className="flex flex-col gap-2">
                <span className="t-micro">
                  {/* La fecha arriba y en pequeño: es lo que se busca de un
                      evento antes que el título. */}
                  {formatearInstante(e.inicioEn, timezone)}
                </span>
                <h3 className="text-[19px] font-bold leading-snug tracking-[-0.02em]">
                  {e.titulo}
                </h3>
              </div>

              {e.descripcion && (
                <p className="line-clamp-3 text-[14.5px] leading-relaxed text-muted-foreground">
                  {e.descripcion}
                </p>
              )}

              <div className="flex flex-col gap-1 text-[13.5px] text-muted-foreground">
                {e.lugar && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="size-[15px] flex-none" strokeWidth={1.7} />
                    {e.lugar}
                  </span>
                )}
                {e.finEn && (
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="size-[15px] flex-none" strokeWidth={1.7} />
                    Hasta el {formatearInstante(e.finEn, timezone)}
                  </span>
                )}
              </div>

              {/* `mt-auto` para que el botón quede abajo del todo aunque las
                  tarjetas tengan descripciones de distinto largo: si no, en una
                  rejilla los botones quedan a alturas distintas. */}
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  render={<Link href={`/i/${slug}/eventos/${e.id}`} />}
                >
                  {e.inscripcionesAbiertas ? 'Apuntarme' : 'Ver más'}
                </Button>
                {e.precio && (
                  <span className="text-[15px] font-bold tracking-[-0.01em]">
                    {formatearDinero(e.precio, moneda)}
                  </span>
                )}
              </div>
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
