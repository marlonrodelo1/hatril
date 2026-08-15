'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, UserPlus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { iniciales } from '@/lib/format/iniciales';
import { ESTADOS, type EstadoMiembro } from '@/lib/miembros/estados';

/**
 * Diálogo para sumar personas a un ministerio.
 *
 * POR QUÉ ESTE SÍ ES CLIENTE Y LA FICHA DE MIEMBRO NO
 * ---------------------------------------------------
 * Aquí hay dos estados que tienen que convivir: lo que se está buscando y lo
 * que se lleva marcado. Si la búsqueda fuera al servidor —como en el listado de
 * miembros— cada letra recargaría la lista y se perderían las casillas
 * marcadas. Es justo el caso en el que el estado en cliente vale la pena.
 *
 * Las candidatas llegan ya filtradas del servidor (las que NO están en el
 * equipo) y el filtrado por nombre se hace aquí sobre esa lista.
 *
 * Se abre con `?asignar=1`, así que el botón atrás lo cierra y recargar no deja
 * un diálogo colgado.
 */
export function DialogoAsignar({
  ministerioNombre,
  candidatos,
  accion,
  cerrar,
}: {
  ministerioNombre: string;
  candidatos: { id: string; nombre: string; estado: EstadoMiembro }[];
  accion: (formData: FormData) => Promise<void>;
  cerrar: string;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [marcados, setMarcados] = useState<Set<string>>(new Set());

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return candidatos;
    return candidatos.filter((c) => c.nombre.toLowerCase().includes(q));
  }, [busqueda, candidatos]);

  function alternar(id: string) {
    setMarcados((previos) => {
      const siguiente = new Set(previos);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  }

  const n = marcados.size;

  return (
    <>
      <Link
        href={cerrar}
        scroll={false}
        aria-label="Cerrar"
        className="fixed inset-0 z-40 bg-[#1A1A1A]/34"
      />

      <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-asignar"
          className="pointer-events-auto flex max-h-full w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-border bg-surface"
        >
          <div className="flex items-start gap-3.5 border-b border-border px-5 pb-4 pt-5">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2
                id="titulo-asignar"
                className="text-[19px] font-bold tracking-[-0.022em]"
              >
                Sumar personas a {ministerioNombre}
              </h2>
              <p className="text-[13.5px] text-muted-foreground">
                Marca a quien quieras sumar al equipo.
              </p>
            </div>
            <Link
              href={cerrar}
              scroll={false}
              aria-label="Cerrar"
              className="flex size-8 flex-none items-center justify-center rounded-lg text-muted-foreground no-underline hover:bg-background hover:text-foreground hover:no-underline"
            >
              <X className="size-[17px]" strokeWidth={2} />
            </Link>
          </div>

          <form action={accion} className="flex min-h-0 flex-1 flex-col">
            {candidatos.length > 0 && (
              <div className="px-5 pb-3 pt-4">
                <div className="relative flex items-center">
                  <Search
                    className="pointer-events-none absolute left-3 size-[17px] text-muted-foreground"
                    strokeWidth={1.6}
                  />
                  <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Busca por nombre…"
                    aria-label="Buscar personas"
                    className="h-[42px] w-full rounded-lg border border-border bg-surface-alt pl-9 pr-3 text-[15px] outline-none focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/16"
                  />
                </div>
              </div>
            )}

            <div className="min-h-[180px] flex-1 overflow-y-auto px-5 pb-2">
              {candidatos.length === 0 ? (
                <Vacio texto="Todas las personas del fichero ya están en este equipo." />
              ) : visibles.length === 0 ? (
                <Vacio texto="Nadie con ese nombre está fuera del equipo." />
              ) : (
                visibles.map((c) => {
                  const marcado = marcados.has(c.id);

                  return (
                    <label
                      key={c.id}
                      className={
                        'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 ' +
                        (marcado ? 'bg-accent' : 'hover:bg-background')
                      }
                    >
                      <input
                        type="checkbox"
                        name="miembros"
                        value={c.id}
                        checked={marcado}
                        onChange={() => alternar(c.id)}
                      />
                      <span className="flex size-[34px] flex-none items-center justify-center rounded-full bg-muted text-[12px] font-bold text-muted-foreground">
                        {iniciales(c.nombre)}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[15px] font-semibold">
                          {c.nombre}
                        </span>
                        <span className="text-[12.5px] text-muted-foreground">
                          {ESTADOS[c.estado].etiqueta}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>

            <div className="flex items-center gap-3 border-t border-border bg-[#F5F1EA] px-5 py-4">
              <span className="flex-1 text-[13.5px] text-muted-foreground">
                {n === 0
                  ? 'Nadie marcado todavía'
                  : `${n} ${n === 1 ? 'persona marcada' : 'personas marcadas'}`}
              </span>
              <Button
                variant="outline"
                size="sm"
                render={<Link href={cerrar} scroll={false} />}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={n === 0}>
                {n === 0
                  ? 'Sumar al equipo'
                  : `Sumar a ${n} ${n === 1 ? 'persona' : 'personas'}`}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Vacio({ texto }: { texto: string }) {
  return (
    <div className="flex flex-col items-center gap-3 px-2 py-10 text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-background text-muted-foreground">
        <UserPlus className="size-5" strokeWidth={1.5} />
      </span>
      <p className="max-w-[300px] text-[14.5px] leading-relaxed text-muted-foreground">
        {texto}
      </p>
    </div>
  );
}
