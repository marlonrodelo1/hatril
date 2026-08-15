'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition, useRef } from 'react';
import { ListFilter, Search, X } from 'lucide-react';

import { ESTADOS, ESTADOS_ELEGIBLES } from '@/lib/miembros/estados';

/**
 * Buscador y filtros del listado.
 *
 * TODO EL ESTADO VIVE EN LA URL
 * -----------------------------
 * No hay `useState` con la lista filtrada. Cada cambio reescribe los parámetros
 * de la URL y el servidor devuelve las filas ya filtradas. Sale gratis lo que
 * de otro modo hay que programar: el botón atrás funciona, la pantalla se puede
 * compartir por WhatsApp con los filtros puestos, y recargar no pierde nada.
 *
 * El buscador espera 300 ms antes de consultar. Sin esa pausa, escribir
 * «Carmen» son seis viajes al servidor y las respuestas pueden llegar
 * desordenadas: la de «Carm» después de la de «Carmen», dejando en pantalla un
 * resultado que no corresponde a lo que hay escrito.
 */
export function FiltrosMiembros({
  ministerios,
}: {
  ministerios: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pendiente, iniciar] = useTransition();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function aplicar(clave: string, valor: string) {
    const siguientes = new URLSearchParams(params.toString());

    if (valor) siguientes.set(clave, valor);
    else siguientes.delete(clave);

    // Cambiar un filtro vuelve siempre a la primera página. Sin esto, filtrar
    // desde la página 4 deja una pantalla vacía que parece «no hay nadie».
    siguientes.delete('pagina');

    iniciar(() => router.push(`?${siguientes.toString()}`, { scroll: false }));
  }

  function buscar(valor: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => aplicar('q', valor.trim()), 300);
  }

  const estado = params.get('estado') ?? '';
  const ministerioId = params.get('ministerio') ?? '';
  const busqueda = params.get('q') ?? '';

  const chips = [
    estado && {
      etiqueta: `Estado: ${ESTADOS[estado as keyof typeof ESTADOS]?.etiqueta ?? estado}`,
      quitar: () => aplicar('estado', ''),
    },
    ministerioId && {
      etiqueta: `Ministerio: ${ministerios.find((m) => m.id === ministerioId)?.nombre ?? ''}`,
      quitar: () => aplicar('ministerio', ''),
    },
    busqueda && {
      etiqueta: `«${busqueda}»`,
      quitar: () => aplicar('q', ''),
    },
  ].filter(Boolean) as { etiqueta: string; quitar: () => void }[];

  const claseSelect =
    'h-9 cursor-pointer rounded-lg border border-border bg-surface-alt pl-3 pr-8 text-[14px] font-medium outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16';

  return (
    <div
      className="flex flex-col gap-3"
      data-pendiente={pendiente ? '' : undefined}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="mr-0.5 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <ListFilter className="size-4" strokeWidth={1.7} />
          Filtrar por
        </span>

        <div className="relative flex items-center md:hidden">
          <Search
            className="pointer-events-none absolute left-3 size-4 text-muted-foreground"
            strokeWidth={1.6}
          />
          <input
            type="search"
            defaultValue={busqueda}
            onChange={(e) => buscar(e.target.value)}
            placeholder="Busca por nombre…"
            aria-label="Buscar personas"
            className="h-9 w-full rounded-lg border border-border bg-surface-alt pl-9 pr-3 text-[14px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
          />
        </div>

        <select
          value={estado}
          onChange={(e) => aplicar('estado', e.target.value)}
          aria-label="Filtrar por estado"
          className={claseSelect}
        >
          <option value="">Estado</option>
          {ESTADOS_ELEGIBLES.map((e) => (
            <option key={e} value={e}>
              {ESTADOS[e].etiqueta}
            </option>
          ))}
        </select>

        <select
          value={ministerioId}
          onChange={(e) => aplicar('ministerio', e.target.value)}
          aria-label="Filtrar por ministerio"
          className={claseSelect}
        >
          <option value="">Ministerio</option>
          {ministerios.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nombre}
            </option>
          ))}
        </select>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <span
              key={c.etiqueta}
              className="inline-flex h-[30px] items-center gap-1.5 rounded-full bg-accent pl-3 pr-1.5 text-[12.5px] font-semibold text-accent-foreground"
            >
              {c.etiqueta}
              <button
                type="button"
                onClick={c.quitar}
                aria-label={`Quitar ${c.etiqueta}`}
                className="flex size-[19px] cursor-pointer items-center justify-center rounded-full text-accent-foreground hover:bg-[#F0D0BE]"
              >
                <X className="size-3.5" strokeWidth={2.4} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={() =>
              iniciar(() => router.push('?', { scroll: false }))
            }
            className="h-[30px] cursor-pointer rounded-lg px-2.5 text-[12.5px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Quitar todos
          </button>
        </div>
      )}
    </div>
  );
}

/** El buscador del encabezado. Mismo comportamiento, otro sitio. */
export function BuscadorMiembros() {
  const router = useRouter();
  const params = useSearchParams();
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  function buscar(valor: string) {
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      const siguientes = new URLSearchParams(params.toString());
      const limpio = valor.trim();
      if (limpio) siguientes.set('q', limpio);
      else siguientes.delete('q');
      siguientes.delete('pagina');
      router.push(`?${siguientes.toString()}`, { scroll: false });
    }, 300);
  }

  return (
    <div className="relative hidden items-center md:flex">
      <Search
        className="pointer-events-none absolute left-3 size-[17px] text-muted-foreground"
        strokeWidth={1.6}
      />
      <input
        type="search"
        defaultValue={params.get('q') ?? ''}
        onChange={(e) => buscar(e.target.value)}
        placeholder="Busca por nombre…"
        aria-label="Buscar personas"
        className="h-10 w-[280px] rounded-lg border border-border bg-surface-alt pl-9 pr-3 text-[14.5px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
      />
    </div>
  );
}
