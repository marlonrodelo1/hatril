'use client';

import { Fragment, useEffect, useState, type KeyboardEvent } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';
import { clsx } from 'clsx';

import { compartir as compartirConElSistema } from '@/lib/compartir';
import { TextoAMedida } from '../../_components/tamano-letra';

/**
 * Un capítulo, donde tocar un versículo lo marca para compartirlo o copiarlo.
 *
 * Se pueden marcar varios seguidos o sueltos; se comparten en orden, con la
 * cita y la versión al final: «… — Juan 3:16-17 (RV1909)». Con la hoja de
 * compartir del sistema si la hay —en el móvil, el WhatsApp de la persona—, y
 * si no, se copia.
 *
 * Sin JavaScript se lee igual: los versículos son texto, y lo único que se
 * pierde es marcarlos.
 *
 * LETRA DE LIBRO, Y SEGUIDA (zona 2 del rediseño, 17-nov)
 * -------------------------------------------------------
 * Era una tarjeta con un botón por versículo, uno debajo de otro, a la misma
 * letra que cualquier lista. Ahora es texto corrido, como en una Biblia de
 * papel, a la letra de lectura que elija cada uno (`TextoAMedida`, 17 px si no
 * ha elegido) y sin tarjeta: el crema de la página ya es el papel.
 *
 * Por eso cada versículo es un `<span role="button">` y no un `<button>`: un
 * botón es una caja, y una caja no parte su texto entre dos renglones. Lleva
 * lo que un botón trae de serie: foco, Intro y Espacio, y `aria-pressed`.
 *
 * LA BARRA DE ACCIONES, ABAJO
 * ---------------------------
 * Estuvo pegada arriba porque abajo la tapaban la barra de pestañas y la
 * radio, y no se sabía cuánto medían. Ahora la barra de pestañas publica lo
 * que ocupa (`--alto-barra-mi`) y esta se pone 8 px por encima: abajo es donde
 * está el pulgar, y arriba la tapaba el propio dedo que acababa de marcar.
 *
 * Con radio, la barra de acciones queda ENCIMA del reproductor (`z-40`, por
 * encima de su `z-30`) mientras haya algo marcado. Es un rato, lo que se tarda
 * en copiar, y la radio vuelve a verse al desmarcar; la alternativa, subirla
 * por encima de la radio, obligaría a saber si la iglesia tiene radio, y eso
 * es una consulta más. Las hojas (`z-40`/`z-50`, al final del `<body>`) siguen
 * pasando por encima de ella.
 *
 * Es carbón y no naranja, igual que sus botones: es la caja de herramientas de
 * lo marcado, no la acción de la pantalla. Y así la Biblia no tiene ningún
 * botón naranja, que es lo que pide la regla de uno como mucho.
 */
export function Capitulo({
  versiculos,
  libro,
  capitulo,
}: {
  versiculos: string[];
  libro: string;
  capitulo: number;
}) {
  const [marcados, setMarcados] = useState<number[]>([]);
  const [copiado, setCopiado] = useState(false);

  // La marca de «copiado» vuelve sola a los dos segundos, como en el
  // devocional: una que se queda para siempre deja de decir que acaba de pasar
  // algo.
  useEffect(() => {
    if (!copiado) return;
    const t = setTimeout(() => setCopiado(false), 2000);
    return () => clearTimeout(t);
  }, [copiado]);

  const hay = marcados.length > 0;

  function alternar(n: number) {
    setCopiado(false);
    setMarcados((m) =>
      m.includes(n) ? m.filter((x) => x !== n) : [...m, n].sort((a, b) => a - b),
    );
  }

  function alPulsarTecla(e: KeyboardEvent, n: number) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    // Sin esto, Espacio además baja la página: es lo que hace sobre un texto.
    e.preventDefault();
    alternar(n);
  }

  /** «Salmos 23:1-3» si son seguidos; «Salmos 23:1, 3» si no. */
  function referencia(): string {
    const seguidos = marcados.every((n, i) => i === 0 || n === marcados[i - 1]! + 1);
    const nums =
      marcados.length === 1
        ? `${marcados[0]}`
        : seguidos
          ? `${marcados[0]}-${marcados[marcados.length - 1]}`
          : marcados.join(', ');
    return `${libro} ${capitulo}:${nums}`;
  }

  function texto(): string {
    const cuerpo = marcados.map((n) => versiculos[n - 1]).join(' ');
    return `«${cuerpo}» — ${referencia()} (RV1909)`;
  }

  // Por `lib/compartir`: en la app, la hoja nativa (el WebView de Android no
  // tiene `navigator.share` y aquí se acababa copiando).
  async function compartir() {
    const resultado = await compartirConElSistema({ texto: texto() });
    if (resultado === 'compartido') setMarcados([]);
    if (resultado === 'copiado') setCopiado(true);
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto());
      setCopiado(true);
    } catch {
      // Sin permiso de portapapeles no hay nada que hacer desde aquí, y un
      // error rojo por no poder copiar un versículo es desproporcionado.
      setCopiado(false);
    }
  }

  const botonBarra =
    'inline-flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-lg bg-support-hover px-2.5 text-label font-semibold text-secondary-foreground outline-none transition-colors duration-150 hover:bg-support-active focus-visible:ring-2 focus-visible:ring-secondary-foreground/50 motion-reduce:transition-none';

  return (
    <>
      <TextoAMedida para="biblia" className="px-1">
        <p className="text-pretty leading-[1.75]">
          {versiculos.map((t, i) => {
            const n = i + 1;
            const marcado = marcados.includes(n);
            return (
              <Fragment key={n}>
                <span
                  role="button"
                  tabIndex={0}
                  aria-pressed={marcado}
                  onClick={() => alternar(n)}
                  onKeyDown={(e) => alPulsarTecla(e, n)}
                  className={clsx(
                    // `box-decoration-break: clone`: un versículo que se parte
                    // en dos renglones lleva el fondo y las esquinas en los dos,
                    // y no un rectángulo cortado a tijera.
                    'cursor-pointer rounded-md px-0.5 py-px outline-none transition-colors duration-150 box-decoration-clone focus-visible:ring-2 focus-visible:ring-ring/30 motion-reduce:transition-none',
                    marcado ? 'bg-accent' : 'hover:bg-surface-alt',
                  )}
                >
                  <sup
                    className={clsx(
                      'mr-1 text-micro font-bold leading-none tabular-nums',
                      marcado ? 'text-accent-foreground' : 'text-muted-foreground',
                    )}
                  >
                    {n}
                  </sup>
                  {t}
                </span>{' '}
              </Fragment>
            );
          })}
        </p>
      </TextoAMedida>

      {/* Lo que ocupa la barra de acciones, para que el último versículo se
          pueda subir por encima de ella y marcarlo. Solo mientras se ve. */}
      {hay && <div aria-hidden className="h-16 flex-none" />}

      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--alto-barra-mi,72px)_+_8px)] z-40 flex justify-center px-3">
        <div
          role="region"
          aria-label="Versículos marcados"
          className={clsx(
            'pointer-events-auto flex w-full max-w-[588px] items-center gap-1 rounded-xl bg-support py-1.5 pl-3.5 pr-1.5 text-secondary-foreground',
            // Sube desde abajo al marcar y baja al desmarcar. `visibility` en
            // la transición para que al esconderse no desaparezca de golpe,
            // y para que escondida no se pueda tabular a sus botones.
            'transition-[translate,opacity,visibility] duration-240 ease-hatril motion-reduce:transition-none',
            hay ? 'visible translate-y-0 opacity-100' : 'invisible translate-y-4 opacity-0',
          )}
        >
          <span className="min-w-0 flex-1 truncate text-label font-semibold">
            {hay ? referencia() : ''}
          </span>

          {/* El rótulo no cambia, para que el botón no cambie de ancho y la
              cita no baile: lo que confirma es el icono, que pasa a una marca.
              El lector de pantalla lo oye por la región viva. */}
          <button type="button" onClick={copiar} className={botonBarra}>
            {copiado ? (
              <Check
                key="copiado"
                aria-hidden
                strokeWidth={1.8}
                className="anim-salta size-4"
              />
            ) : (
              <Copy aria-hidden strokeWidth={1.8} className="size-4" />
            )}
            Copiar
          </button>
          <span className="sr-only" aria-live="polite">
            {copiado ? 'Copiado' : ''}
          </span>

          <button type="button" onClick={compartir} className={botonBarra}>
            <Share2 aria-hidden strokeWidth={1.8} className="size-4" />
            Compartir
          </button>

          <button
            type="button"
            onClick={() => setMarcados([])}
            aria-label="Desmarcar"
            className="flex size-9 flex-none cursor-pointer items-center justify-center rounded-lg text-support-muted-foreground outline-none transition-colors duration-150 hover:bg-support-hover hover:text-secondary-foreground focus-visible:ring-2 focus-visible:ring-secondary-foreground/50 motion-reduce:transition-none"
          >
            <X aria-hidden strokeWidth={1.8} className="size-4" />
          </button>
        </div>
      </div>
    </>
  );
}
