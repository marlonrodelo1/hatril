'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type TransitionEvent,
} from 'react';
import { ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';

/**
 * El cuerpo del devocional en la web pública: el arranque, y «Seguir leyendo»
 * lo despliega en el sitio (rediseño de la zona 3, 17-nov).
 *
 * Iba entero, y un devocional largo empujaba los grupos y el contacto media
 * página hacia abajo a quien solo venía a ver el horario. Desplegarlo aquí
 * mismo, y no en otra página, deja al que sí quería leerlo donde estaba.
 *
 * EL TEXTO ENTERO VA EN EL HTML
 * -----------------------------
 * Lo cerrado es solo una altura máxima: el texto está todo en la página, para
 * los buscadores y para un lector de pantalla, que lo lee seguido.
 *
 * LA ALTURA, ANIMADA A MANO
 * -------------------------
 * CSS no anima hasta `auto`. Al abrir se va de cuatro líneas a la altura medida
 * del texto, y al terminar se suelta (`none`) para que un giro del móvil no lo
 * recorte. Al cerrar, el camino inverso: primero la altura en píxeles —desde
 * `none` no hay transición posible— y luego las cuatro líneas. Con «reducir
 * movimiento», salta sin animar.
 */

// Cuatro líneas a interlineado 1,7. En `em` para que siga al tamaño de letra.
const CERRADO = '6.8em';

function pideMenosMovimiento() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DevocionalTexto({
  parrafos,
  extra,
}: {
  parrafos: string[];
  /** Lo que va en la fila del botón: «Verlo en vídeo», si lo hay. */
  extra?: ReactNode;
}) {
  const id = useId();
  const caja = useRef<HTMLDivElement>(null);
  const [abierto, setAbierto] = useState(false);
  const [alto, setAlto] = useState(CERRADO);
  // Si el texto cabe entero en las cuatro líneas, ni botón ni velo. De
  // partida se adivina por el largo, para que lo corto no enseñe el botón un
  // instante; luego lo dice la medida de verdad.
  const [cabe, setCabe] = useState(
    () => parrafos.length === 1 && parrafos[0]!.length < 140,
  );

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    // `ResizeObserver` avisa nada más observar, así que también hace la
    // primera medida; y vuelve a medir si cambia el ancho (girar el móvil).
    const observador = new ResizeObserver(() => {
      if (el.style.maxHeight !== CERRADO) return;
      setCabe(el.scrollHeight <= el.clientHeight + 2);
    });
    observador.observe(el);
    return () => observador.disconnect();
  }, []);

  function alternar() {
    const el = caja.current;
    if (!el) return;
    const quieto = pideMenosMovimiento();

    if (!abierto) {
      setAbierto(true);
      setAlto(quieto ? 'none' : `${el.scrollHeight}px`);
      return;
    }

    if (!quieto) {
      el.style.maxHeight = `${el.scrollHeight}px`;
      // Forzar el cálculo de estilos aquí es lo que hace que el navegador vea
      // el punto de partida en píxeles antes de pedirle las cuatro líneas.
      void el.offsetHeight;
    }
    setAbierto(false);
    setAlto(CERRADO);

    // Quien lo ha leído entero tiene el botón muy abajo: al recogerse, la
    // página se encoge por encima de él y aparecería en los grupos. Se le
    // devuelve al principio del texto si ya no lo ve.
    if (el.getBoundingClientRect().top < 0) {
      el.scrollIntoView({ block: 'start', behavior: quieto ? 'auto' : 'smooth' });
    }
  }

  function alTerminar(e: TransitionEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.propertyName !== 'max-height') return;
    if (abierto) setAlto('none');
  }

  const conBoton = !cabe || abierto;

  return (
    <>
      <div
        id={id}
        ref={caja}
        style={{ maxHeight: alto }}
        onTransitionEnd={alTerminar}
        className="relative max-w-[62ch] scroll-mt-24 overflow-hidden text-body leading-[1.7] text-foreground transition-[max-height] duration-360 ease-hatril motion-reduce:transition-none"
      >
        {parrafos.map((p, i) => (
          <p key={i} className="mb-3 text-pretty last:mb-0">
            {p}
          </p>
        ))}

        {/* La última línea, medio tapada: dice que el texto sigue sin un
            degradado (regla 3). Un velo plano del color de la tarjeta. */}
        <span
          aria-hidden
          className={clsx(
            'pointer-events-none absolute inset-x-0 bottom-0 h-[1.7em] bg-surface/85 transition-opacity duration-240 ease-hatril motion-reduce:transition-none',
            !conBoton || abierto ? 'opacity-0' : 'opacity-100',
          )}
        />
      </div>

      {(conBoton || extra) && (
        <div className="flex flex-wrap items-center gap-2">
          {conBoton && (
            <Button
              variant="outline"
              size="sm"
              onClick={alternar}
              aria-expanded={abierto}
              aria-controls={id}
            >
              {abierto ? 'Leer menos' : 'Seguir leyendo'}
              <ChevronDown
                strokeWidth={1.8}
                aria-hidden
                className={clsx(
                  'transition-transform duration-240 ease-hatril motion-reduce:transition-none',
                  abierto && 'rotate-180',
                )}
              />
            </Button>
          )}
          {extra}
        </div>
      )}
    </>
  );
}
