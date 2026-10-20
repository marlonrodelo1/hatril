import type { Programa } from '@/lib/emisora/config';
import { franjaDe, parrillaPorDia } from '@/lib/emisora/parrilla';

/**
 * La parrilla de la semana, por días.
 *
 * El nombre del programa, su franja y de qué va. No hay sitio para quién
 * presenta y no es un olvido: la misma lista sale en la web pública, y el
 * nombre de un locutor al lado de su iglesia es su confesión religiosa
 * publicada en internet.
 * Los locutores de cada emisión son turnos, y esos los ve el equipo.
 */
export function ProgramacionSemanal({
  parrilla,
  hoy,
  ahora,
}: {
  parrilla: Programa[];
  /** Para marcar el día de hoy. `null` mientras no se sabe. */
  hoy?: Programa['dia'] | null;
  ahora?: Programa | null;
}) {
  const dias = parrillaPorDia(parrilla);

  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
      {dias.map(({ dia, programas }) => {
        const esHoy = dia === hoy;
        return (
          <section
            key={dia}
            aria-label={dia}
            className={
              'flex flex-col gap-2 rounded-xl border bg-surface-alt p-4 ' +
              (esHoy ? 'border-support' : 'border-border')
            }
          >
            <h3 className="flex items-baseline justify-between gap-2 text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground">
              {dia}
              {esHoy && (
                <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] normal-case tracking-normal text-accent-foreground">
                  Hoy
                </span>
              )}
            </h3>
            <ul className="flex flex-col gap-2.5">
              {programas.map((p, i) => {
                const suena = ahora === p;
                return (
                  <li
                    // Con el índice: la base no impide dos filas iguales si
                    // llegan por otro camino que la action, y una clave
                    // repetida en una lista que se repinta cada medio minuto
                    // acaba pintando la fila que no es.
                    key={`${p.hora}-${p.nombre}-${i}`}
                    className="flex items-baseline gap-3 text-[14.5px] leading-snug"
                  >
                    <span className="w-[104px] flex-none tabular-nums text-muted-foreground">
                      {franjaDe(p)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="font-semibold">
                        {p.nombre}
                        {suena && (
                          <span className="ml-2 text-[12px] font-bold text-badge-accent-fg">
                            Ahora
                          </span>
                        )}
                      </span>
                      {p.tema && (
                        <span className="text-pretty text-[13.5px] text-muted-foreground">
                          {p.tema}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
