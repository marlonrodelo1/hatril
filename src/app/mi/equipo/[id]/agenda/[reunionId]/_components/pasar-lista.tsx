'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CheckCheck, X } from 'lucide-react';
import { clsx } from 'clsx';

import { AvatarPersona } from '@/components/avatar-persona';
import { Button } from '@/components/ui/button';
import { Lista } from '@/components/ui/fila';

export type PersonaDeLaLista = {
  miembroId: string;
  nombre: string;
  /** Cómo sale de entrada: lo guardado, o todos marcados la primera vez. */
  marcado: boolean;
};

/**
 * La lista del ensayo: el recuento, «Marcar a todos» y una fila por persona.
 *
 * SIGUEN SIENDO CASILLAS NATIVAS, Y A PROPÓSITO
 * ---------------------------------------------
 * Cada fila es un `<label>` con su `<input type="checkbox" name="presentes">`
 * dentro, oculto a la vista (`sr-only`) pero no al formulario ni al lector de
 * pantalla. Lo que viaja al guardar es exactamente lo de antes —un `presentes`
 * por cada uuid marcado—, así que la action no sabe que la pantalla cambió, y
 * sin JavaScript (la red del templo, una página a medio cargar) la lista se
 * marca y se guarda igual: el `label` entero marca su casilla él solo.
 *
 * Por lo mismo, el verde de la fila y del círculo lo pone el CSS
 * (`has-checked:`), no el estado de React: se ve marcada justo cuando la
 * casilla lo está, haya JavaScript o no. Lo único que pone React es lo que no
 * hace falta para guardar: el recuento en vivo y el salto del círculo.
 *
 * NO CONTROLADAS
 * --------------
 * `defaultChecked` y no `checked`: el recuento se lee del DOM, que es lo que
 * se va a enviar. Con casillas controladas, si el navegador devuelve la página
 * con las marcas de antes (volver atrás, recargar en Firefox), el estado de
 * React diría una cosa y el formulario enviaría otra.
 */
/** Las casillas de la lista, tal como van a viajar en el formulario. */
function casillasDe(raiz: HTMLElement | null): HTMLInputElement[] {
  return Array.from(
    raiz?.querySelectorAll<HTMLInputElement>('input[name="presentes"]') ?? [],
  );
}

export function PasarLista({ personas }: { personas: PersonaDeLaLista[] }) {
  const lista = useRef<HTMLDivElement>(null);
  const total = personas.length;
  const [vinieron, setVinieron] = useState(
    () => personas.filter((p) => p.marcado).length,
  );
  /*
   * Quién acaba de marcarse, con su retraso. Solo esas filas llevan
   * `anim-salta`: con la clase puesta desde el servidor, la primera vez —que
   * salen todos marcados— saltaría la lista entera al abrirla.
   */
  const [saltan, setSaltan] = useState<ReadonlyMap<string, number>>(new Map());

  const recontar = () =>
    setVinieron(casillasDe(lista.current).filter((c) => c.checked).length);

  // La página que vuelve de la caché del navegador trae las casillas como se
  // dejaron, no como las pintó el servidor.
  useEffect(() => {
    const alVolver = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      setVinieron(casillasDe(lista.current).filter((c) => c.checked).length);
    };
    window.addEventListener('pageshow', alVolver);
    return () => window.removeEventListener('pageshow', alVolver);
  }, []);

  const todos = vinieron === total;

  function marcarTodos() {
    const siguientes = new Map<string, number>();
    let orden = 0;
    for (const c of casillasDe(lista.current)) {
      if (todos) {
        c.checked = false;
      } else if (!c.checked) {
        c.checked = true;
        // Uno detrás de otro, como si se marcaran a mano. Con «reducir
        // movimiento» `anim-salta` no anima, y el retraso no se nota.
        siguientes.set(c.value, Math.min(orden++ * 45, 450));
      }
    }
    setSaltan(siguientes);
    recontar();
  }

  const porcentaje = total === 0 ? 0 : Math.round((vinieron / total) * 100);

  return (
    <>
      {/*
       * El recuento, con la forma de `Cifra` pero sin `Cifra`: aquella cuenta
       * desde cero cada vez que cambia el número (empezaría de nuevo a cada
       * toque) y su barra no se mueve. `role="status"` solo en el rótulo y la
       * cifra, para que el lector diga «Han venido 7 de 9» al marcar, entero,
       * y no lea también el botón de al lado.
       */}
      <section className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4">
        <div className="flex items-end justify-between gap-3">
          <div role="status" aria-atomic="true" className="flex flex-col gap-2.5">
            <span className="t-micro">Han venido</span>
            <span className="flex items-baseline gap-1.5 text-foreground">
              {/* La cifra entra de nuevo a cada cambio (`key`): se ve que se
                  ha movido sin tener que leerla. */}
              <span key={vinieron} className="anim-aparece inline-block t-cifra tabular-nums">
                {vinieron}
              </span>
              <span className="text-label font-semibold text-muted-foreground">
                de {total}
              </span>
            </span>
          </div>
          {/*
           * Junto a la cifra a la que afecta, y no al lado del rótulo de la
           * lista, que a 375 px partía en dos renglones.
           *
           * Cambia a «Desmarcar a todos» cuando ya están todos: la primera vez
           * salen todos marcados, y un «Marcar a todos» que no hace nada no
           * sirve. De contorno: el naranja es «Guardar la lista».
           */}
          <Button type="button" variant="outline" size="sm" onClick={marcarTodos}>
            {todos ? (
              <>
                <X strokeWidth={1.8} />
                Desmarcar a todos
              </>
            ) : (
              <>
                <CheckCheck strokeWidth={1.8} />
                Marcar a todos
              </>
            )}
          </Button>
        </div>
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-active" aria-hidden>
          <span
            className="block h-full rounded-full bg-support transition-[width] duration-360 ease-hatril motion-reduce:transition-none"
            style={{ width: `${porcentaje}%` }}
          />
        </span>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-col gap-0.5 px-1">
          <h2 className="t-micro">Quién del equipo vino</h2>
          {/* Lo dice para que nadie crea que está marcando la asistencia de
              esas personas a la iglesia: un ensayo no cuenta para el culto. */}
          <p className="text-label text-muted-foreground">
            Solo el equipo, y no cuenta para la asistencia a los cultos.
          </p>
        </div>

        {/* El ref va en un envoltorio: `Lista` no lo reenvía a su `<ul>`. */}
        <div ref={lista}>
          <Lista>
            {personas.map((p) => {
              const retraso = saltan.get(p.miembroId);
              return (
                <li key={p.miembroId} className="border-b border-border last:border-b-0">
                  {/*
                   * La fila entera es el control: se marca con el pulgar, de
                   * pie en la sala y con el móvil en una mano. Teñida en un
                   * verde suave al marcarla —antes iba sin teñir porque el
                   * salmón de entonces tapaba avatares y líneas; este verde
                   * a media tinta deja ver las dos—, y lo que lo dice de
                   * verdad es el círculo de la derecha.
                   */}
                  <label
                    className={clsx(
                      'group flex min-h-16 cursor-pointer items-center gap-3 px-4 py-3 transition-colors duration-150 ease-hatril select-none motion-reduce:transition-none md:px-5',
                      'hover:bg-surface-alt has-checked:bg-badge-success-bg/60 has-checked:hover:bg-badge-success-bg',
                      'has-focus-visible:ring-3 has-focus-visible:ring-ring/20 has-focus-visible:ring-inset',
                    )}
                  >
                    <input
                      type="checkbox"
                      name="presentes"
                      value={p.miembroId}
                      defaultChecked={p.marcado}
                      className="sr-only"
                      onChange={(e) => {
                        const marcada = e.currentTarget.checked;
                        setSaltan((antes) => {
                          const siguientes = new Map(antes);
                          if (marcada) siguientes.set(p.miembroId, 0);
                          else siguientes.delete(p.miembroId);
                          return siguientes;
                        });
                        recontar();
                      }}
                    />
                    <AvatarPersona nombre={p.nombre} tamano="md" />
                    <span className="min-w-0 flex-1 truncate text-body font-semibold">
                      {p.nombre}
                    </span>
                    <span
                      aria-hidden
                      className={clsx(
                        'flex size-7 flex-none items-center justify-center rounded-full border-[1.5px] border-border-strong text-transparent transition-colors duration-240 ease-hatril motion-reduce:transition-none',
                        'group-has-checked:border-badge-success-fg group-has-checked:bg-badge-success-fg group-has-checked:text-primary-foreground',
                        retraso !== undefined && 'anim-salta',
                      )}
                      style={retraso ? { animationDelay: `${retraso}ms` } : undefined}
                    >
                      <Check className="size-4" strokeWidth={1.8} />
                    </span>
                  </label>
                </li>
              );
            })}
          </Lista>
        </div>
      </section>
    </>
  );
}
