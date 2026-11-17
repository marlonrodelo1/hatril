import type { IglesiaPublica } from '@/lib/iglesias/publica';
import { minutoDeGeneracion } from './horarios-semana';
import { VistaHorarios } from './horarios-vista';

/** Los horarios de la semana. Solo se pinta si la iglesia tiene alguno. */
export function SeccionHorarios({
  iglesia,
  tieneContacto,
}: {
  iglesia: IglesiaPublica;
  tieneContacto: boolean;
}) {
  // El instante en que se genera esta copia de la página (ISR, cada 60 s como
  // mucho). Es lo que pinta el servidor y el primer fotograma del navegador;
  // en cuanto hidrata, `VistaHorarios` pasa a la hora de verdad.
  const generadoEn = minutoDeGeneracion();

  return (
    // `scroll-mt` en todas las secciones con ancla: la cabecera flota por
    // encima, y sin este margen el título de la sección aterriza debajo de
    // ella. Se nota justo en el gesto más usado de la página —pulsar
    // «Horarios»— y parece que el enlace ha fallado.
    <section
      id="horarios"
      className="mx-auto max-w-[1180px] scroll-mt-20 px-4 py-14 sm:px-5 md:px-10 md:py-16 lg:py-20"
    >
      <div className="mb-8 flex flex-col gap-3">
        <span className="t-micro text-badge-accent-fg">Cuándo nos vemos</span>
        <h2 className="max-w-[600px] text-pretty text-[30px] font-extrabold leading-[1.06] tracking-[-0.035em] md:text-[38px]">
          Horarios de la semana
        </h2>
      </div>

      <VistaHorarios
        horarios={iglesia.horarios}
        timezone={iglesia.timezone}
        generadoEn={generadoEn}
        tieneContacto={tieneContacto}
      />
    </section>
  );
}
