'use client';

import { useState } from 'react';
import { Check, Copy, Share2, X } from 'lucide-react';

import { Button } from '@/components/ui/button';

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

  function alternar(n: number) {
    setCopiado(false);
    setMarcados((m) => (m.includes(n) ? m.filter((x) => x !== n) : [...m, n].sort((a, b) => a - b)));
  }

  function cita(): string {
    // «3:16-18» si son seguidos; «3:16, 18» si no.
    const seguidos = marcados.every((n, i) => i === 0 || n === marcados[i - 1]! + 1);
    const nums =
      marcados.length === 1
        ? `${marcados[0]}`
        : seguidos
          ? `${marcados[0]}-${marcados[marcados.length - 1]}`
          : marcados.join(', ');
    return `${libro} ${capitulo}:${nums} (RV1909)`;
  }

  function texto(): string {
    const cuerpo = marcados.map((n) => versiculos[n - 1]).join(' ');
    return `«${cuerpo}» — ${cita()}`;
  }

  async function compartir() {
    const t = texto();
    if (navigator.share) {
      try {
        await navigator.share({ text: t });
        setMarcados([]);
      } catch {
        // Cancelado: no es un error.
      }
      return;
    }
    await copiar();
  }

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto());
      setCopiado(true);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <>
      {marcados.length > 0 && (
        /*
         * Pegada arriba, bajo la cabecera, mientras haya algo marcado. Abajo la
         * tapaban la barra de pestañas y el reproductor de la radio, cuya altura
         * depende de la iglesia. Sin hoja ni capa: se sigue leyendo y marcando.
         */
        <div className="sticky top-[calc(4.5rem+env(safe-area-inset-top))] z-10 flex flex-col gap-2 rounded-xl border border-border bg-surface p-2.5">
          <div className="flex items-center gap-2 pl-1">
            <span className="min-w-0 flex-1 truncate text-[14.5px] font-semibold">{cita()}</span>
            <button
              type="button"
              onClick={() => setMarcados([])}
              aria-label="Desmarcar"
              className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/20"
            >
              <X className="size-[18px]" strokeWidth={1.9} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={copiar}>
              {copiado ? <Check strokeWidth={1.8} /> : <Copy strokeWidth={1.8} />}
              {copiado ? 'Copiado' : 'Copiar'}
            </Button>
            <Button type="button" onClick={compartir}>
              <Share2 strokeWidth={1.8} />
              Compartir
            </Button>
          </div>
        </div>
      )}

      <article className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-3 sm:p-4">
        {versiculos.map((t, i) => {
          const n = i + 1;
          const marcado = marcados.includes(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => alternar(n)}
              aria-pressed={marcado}
              className={
                'cursor-pointer rounded-lg px-2 py-1.5 text-left text-pretty text-[16.5px] leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/20 ' +
                (marcado ? 'bg-accent text-accent-foreground' : 'hover:bg-surface-alt')
              }
            >
              <span className="mr-1.5 align-baseline text-[12px] font-bold text-accent-brand">{n}</span>
              {t}
            </button>
          );
        })}
      </article>

    </>
  );
}
