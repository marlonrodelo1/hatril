import Link from 'next/link';
import { CalendarRange, ChevronRight, Clock } from 'lucide-react';

import type { EventoPublico } from '@/lib/eventos/publica';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Insignia } from '@/components/ui/insignia';
import { FechaEvento, cuandoCorto, esDeVariosDias } from './eventos-piezas';

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
 * escriba en la descripción: un texto suyo no se puede sondear. La insignia
 * «Inscripción abierta» sale de `inscripciones_abiertas`, que decide el pastor
 * a mano y no se mueve sola al llenarse: no dice nada de quién va.
 *
 * LA FECHA PRIMERO (rediseño de la zona 3, 17-nov)
 * ------------------------------------------------
 * Antes la fecha iba en pequeño encima del título, y es justo lo que se busca
 * de un evento. Ahora es el bloque del mes y el día, a la izquierda; debajo
 * del título, cuándo y dónde. La descripción y el cartel se quedan en la
 * página del evento: aquí se elige a cuál entrar, y toda la tarjeta lleva a él.
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
    // `auto-fill` y no `auto-fit`: con dos eventos en un monitor, `auto-fit`
    // los estiraba a media pantalla cada uno y la tarjeta, que es una fila,
    // quedaba con el título en una esquina y la flecha en la otra.
    <ul className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
      {eventos.map((e) => {
        const variosDias = esDeVariosDias(e, timezone);
        const IconoCuando = variosDias ? CalendarRange : Clock;
        return (
          <li key={e.id} className="flex">
            {/* `text-foreground` porque `globals.css` pinta de naranja todo
                `<a>`, y lo de dentro lo heredaría (regla 11). */}
            <Link
              href={`/i/${slug}/eventos/${e.id}`}
              className="grid w-full grid-cols-[54px_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border bg-surface p-3 text-foreground no-underline transition-colors duration-150 ease-hatril hover:border-border-strong hover:bg-surface-alt hover:no-underline motion-reduce:transition-none"
            >
              <FechaEvento inicioEn={e.inicioEn} timezone={timezone} />

              <span className="flex min-w-0 flex-col gap-1">
                <span className="text-body font-semibold leading-snug text-pretty">
                  {e.titulo}
                </span>
                {/* Sin `truncate`: un lugar largo («Finca La Vega,
                    Cundinamarca») se cortaba justo en lo que hace falta para
                    llegar. Mejor dos líneas. */}
                <span className="flex min-w-0 items-start gap-1.5 text-label text-muted-foreground">
                  <IconoCuando className="mt-[3px] size-3.5 flex-none" strokeWidth={1.8} aria-hidden />
                  <span className="text-pretty">
                    {cuandoCorto(e, timezone)}
                    {e.lugar && ` · ${e.lugar}`}
                  </span>
                </span>
                {(e.inscripcionesAbiertas || e.precio) && (
                  <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    {e.inscripcionesAbiertas && (
                      <Insignia tono="exito" punto>
                        Inscripción abierta
                      </Insignia>
                    )}
                    {e.precio && (
                      // En carbón y no en naranja: una cifra de dinero nunca
                      // va en el color de las acciones (guía, «Cifras»).
                      <span className="text-label font-semibold text-foreground tabular-nums">
                        {formatearDinero(e.precio, moneda)}
                      </span>
                    )}
                  </span>
                )}
              </span>

              <ChevronRight
                className="size-4 flex-none text-muted-foreground"
                strokeWidth={1.8}
                aria-hidden
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
