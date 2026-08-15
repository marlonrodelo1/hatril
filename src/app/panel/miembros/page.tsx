import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus, SearchX, UserPlus } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { puede, esPastor } from '@/lib/auth/permisos';
import {
  listarMiembros,
  listarMinisterios,
  resumenMiembros,
  POR_PAGINA,
  type FiltrosMiembros as Filtros,
} from '@/lib/miembros/consultas';
import { ESTADOS, type EstadoMiembro } from '@/lib/miembros/estados';
import { iniciales } from '@/lib/format/iniciales';
import { Button } from '@/components/ui/button';
import { FiltrosMiembros, BuscadorMiembros } from './_components/filtros';
import { FichaMiembroPanel } from './_components/ficha';
import { Paginacion } from './_components/paginacion';

export const metadata: Metadata = { title: 'Miembros' };

function esEstadoValido(v: string | undefined): v is EstadoMiembro {
  return !!v && v in ESTADOS;
}

export default async function MiembrosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await requireIglesia();
  const sp = await searchParams;

  const primer = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;

  const estado = primer(sp.estado);
  const filtros: Filtros = {
    busqueda: primer(sp.q) || undefined,
    estado: esEstadoValido(estado) ? estado : undefined,
    ministerioId: primer(sp.ministerio) || undefined,
    pagina: Number(primer(sp.pagina)) || 1,
  };

  const fichaId = primer(sp.ficha);

  const [{ filas, total, pagina }, ministerios, resumen] = await Promise.all([
    listarMiembros(ctx, filtros),
    listarMinisterios(ctx),
    resumenMiembros(ctx),
  ]);

  const hayFiltros = Boolean(
    filtros.busqueda || filtros.estado || filtros.ministerioId,
  );
  const puedeCrear = esPastor(ctx) || puede(ctx, 'editar_miembros');

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border bg-surface px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-8">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
            Miembros
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {resumen.total === 0
              ? 'Todavía no hay nadie en el fichero'
              : `${resumen.total} ${resumen.total === 1 ? 'persona' : 'personas'} en la iglesia`}
            {resumen.nuevosDelMes > 0 &&
              ` · ${resumen.nuevosDelMes} se ${resumen.nuevosDelMes === 1 ? 'ha' : 'han'} sumado este mes`}
          </p>
        </div>

        <BuscadorMiembros />

        {puedeCrear && (
          <Button
            render={<Link href="/panel/miembros/nuevo" />}
            className="flex-none"
          >
            <Plus strokeWidth={1.9} />
            Añadir miembro
          </Button>
        )}
      </header>

      <div className="flex w-full max-w-[1400px] flex-1 flex-col gap-4 px-5 pb-10 pt-5 md:px-8">
        <FiltrosMiembros ministerios={ministerios} />

        <div className="overflow-hidden rounded-xl border border-border bg-surface-alt">
          {/* Cabecera de la tabla. Se oculta en móvil: siete columnas en 375px
              no caben, y ahí cada fila se apila como una tarjeta. */}
          <div className="hidden grid-cols-[2.1fr_1fr_1.5fr_1.1fr_.9fr] items-center gap-3.5 border-b border-border bg-surface px-5 py-3 md:grid">
            {['Persona', 'Estado', 'Ministerios', 'Teléfono', 'Alta'].map((c) => (
              <span key={c} className="t-micro">
                {c}
              </span>
            ))}
          </div>

          {filas.length === 0 ? (
            <EstadoVacio hayFiltros={hayFiltros} puedeCrear={puedeCrear} />
          ) : (
            filas.map((m) => {
              const estilo = ESTADOS[m.estado];
              const nombreCompleto = [m.nombre, m.apellidos]
                .filter(Boolean)
                .join(' ');

              return (
                <Link
                  key={m.id}
                  href={`?${new URLSearchParams({ ...limpiar(sp), ficha: m.id })}`}
                  scroll={false}
                  className="grid grid-cols-1 items-center gap-2 border-b border-border px-5 py-3.5 text-foreground no-underline last:border-b-0 hover:bg-surface hover:no-underline md:grid-cols-[2.1fr_1fr_1.5fr_1.1fr_.9fr] md:gap-3.5"
                >
                  <div className="flex min-w-0 items-center gap-[11px]">
                    <span
                      className={`flex size-9 flex-none items-center justify-center rounded-full text-[12.5px] font-bold ${estilo.avatar}`}
                    >
                      {iniciales(nombreCompleto)}
                    </span>
                    <div className="flex min-w-0 flex-col gap-px">
                      <span className="truncate text-[15px] font-semibold">
                        {nombreCompleto}
                      </span>
                      <span className="truncate text-[12.5px] text-muted-foreground">
                        {m.email ?? 'Sin correo'}
                      </span>
                    </div>
                  </div>

                  <span className="flex md:block">
                    <span
                      className={`rounded-full px-2.5 py-[5px] text-[12px] font-semibold ${estilo.badge}`}
                    >
                      {estilo.etiqueta}
                    </span>
                  </span>

                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {m.ministerios.length === 0 ? (
                      <span className="text-[14px] text-muted-foreground">—</span>
                    ) : (
                      <>
                        {m.ministerios.slice(0, 2).map((min) => (
                          <span
                            key={min.id}
                            className="whitespace-nowrap rounded-full bg-background px-2.5 py-1 text-[12px] font-semibold text-muted-foreground"
                          >
                            {min.nombre}
                          </span>
                        ))}
                        {m.ministerios.length > 2 && (
                          <span className="whitespace-nowrap rounded-full border border-border px-2 py-1 text-[12px] font-semibold text-muted-foreground">
                            +{m.ministerios.length - 2}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <span className="whitespace-nowrap text-[14px]">
                    {m.telefono ?? '—'}
                  </span>

                  <span className="whitespace-nowrap text-[14px] text-muted-foreground">
                    {formatearFecha(m.fechaIngreso)}
                  </span>
                </Link>
              );
            })
          )}
        </div>

        {total > POR_PAGINA && (
          <Paginacion total={total} pagina={pagina} porPagina={POR_PAGINA} />
        )}
      </div>

      {fichaId && <FichaMiembroPanel ctx={ctx} miembroId={fichaId} params={sp} />}
    </>
  );
}

/** Quita `ficha` de los parámetros para poder recomponerlos sin duplicar. */
function limpiar(sp: Record<string, string | string[] | undefined>) {
  const salida: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) {
    if (k === 'ficha') continue;
    const valor = Array.isArray(v) ? v[0] : v;
    if (valor) salida[k] = valor;
  }
  return salida;
}

function formatearFecha(fecha: string | null): string {
  if (!fecha) return '—';
  // `T00:00` para que una fecha sin hora no se interprete en UTC y salga el día
  // anterior en husos al oeste de Greenwich, que es donde está Colombia.
  return new Date(`${fecha}T00:00`).toLocaleDateString('es', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function EstadoVacio({
  hayFiltros,
  puedeCrear,
}: {
  hayFiltros: boolean;
  puedeCrear: boolean;
}) {
  // Dos vacíos distintos. «No hay resultados» cuando el fichero está vacío deja
  // al pastor sin saber qué hacer justo el primer día, que es cuando más
  // ayuda necesita.
  const Icono = hayFiltros ? SearchX : UserPlus;

  return (
    <div className="flex flex-col items-center gap-3.5 px-6 py-16 text-center">
      <span className="flex size-13 items-center justify-center rounded-full bg-background text-muted-foreground">
        <Icono className="size-6" strokeWidth={1.5} />
      </span>

      <div className="flex max-w-[380px] flex-col gap-1.5">
        <span className="text-[18px] font-bold tracking-[-0.02em]">
          {hayFiltros ? 'Aquí no aparece nadie' : 'Empieza por tu congregación'}
        </span>
        <span className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">
          {hayFiltros
            ? 'Con esos filtros no hay ninguna persona. Prueba a quitar alguno o a buscar por otro nombre.'
            : 'Añade a las personas que ya vienen a la iglesia. Puedes empezar por unas pocas e ir completando con el tiempo.'}
        </span>
      </div>

      {hayFiltros ? (
        <Button variant="outline" render={<Link href="?" />}>
          Quitar los filtros
        </Button>
      ) : (
        puedeCrear && (
          <Button render={<Link href="/panel/miembros/nuevo" />}>
            <Plus strokeWidth={1.9} />
            Añadir la primera persona
          </Button>
        )
      )}
    </div>
  );
}
