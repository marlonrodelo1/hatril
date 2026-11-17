import type { IglesiaPublica } from '@/lib/iglesias/publica';
import type { radioPublica } from '@/lib/emisora/consultas';
import { RadioIglesia } from './radio';

type Radio = NonNullable<Awaited<ReturnType<typeof radioPublica>>>;

/** La radio, solo si el pastor la marcó para la web. */
export function SeccionRadio({
  iglesia,
  radio,
}: {
  iglesia: IglesiaPublica;
  radio: Radio;
}) {
  return (
    <section
      id="radio"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="mb-8 flex flex-col gap-3">
        <span className="t-micro text-badge-accent-fg">Radio en directo</span>
        <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
          {radio.nombre}
        </h2>
      </div>

      <RadioIglesia
        nombre={radio.nombre}
        streamUrl={radio.streamUrl}
        parrilla={radio.parrilla}
        timezone={iglesia.timezone}
        iglesiaNombre={iglesia.nombre}
        caratula={iglesia.logoUrl}
      />
    </section>
  );
}
