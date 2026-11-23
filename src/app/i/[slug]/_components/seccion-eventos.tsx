import type { EventoPublico } from '@/lib/eventos/publica';
import type { Moneda } from '@/lib/db/schema';
import { EventosIglesia } from './eventos';

/** Los eventos próximos. Solo se pinta si hay alguno. */
export function SeccionEventos({
  eventosDeLaIglesia,
  slug,
  timezone,
  monedaIglesia,
}: {
  eventosDeLaIglesia: EventoPublico[];
  slug: string;
  timezone: string;
  monedaIglesia: Moneda;
}) {
  return (
    <section
      id="eventos"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="mb-7 flex flex-col gap-2">
        <span className="t-micro text-accent-foreground">Próximamente</span>
        <h2 className="text-[clamp(24px,4vw,32px)] font-extrabold leading-tight tracking-[-0.03em]">
          Eventos
        </h2>
      </div>

      <EventosIglesia
        eventos={eventosDeLaIglesia}
        slug={slug}
        timezone={timezone}
        moneda={monedaIglesia}
      />
    </section>
  );
}
