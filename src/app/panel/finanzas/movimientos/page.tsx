import Link from 'next/link';
import type { Metadata } from 'next';
import { Plus } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { libro, opciones } from '@/lib/finanzas/consultas';
import { mesEnLaIglesia, formatearFechaLarga } from '@/lib/fecha/hoy';
import { formatearDineroConSigno } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { CabeceraPanel } from '../../_components/cabecera';
import { Contenedor } from '../../_components/contenedor';

export const metadata: Metadata = { title: 'Libro de movimientos' };

export default async function MovimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    desde?: string;
    hasta?: string;
    fondo?: string;
  }>;
}) {
  const ctx = await requireIglesia();
  const params = await searchParams;
  const moneda = ctx.iglesia.moneda as Moneda;

  // Sin filtro explícito, el mes en curso. Un libro que abre con TODO el
  // histórico es ilegible en cuanto pasa un año.
  const mes = mesEnLaIglesia(ctx.iglesia.timezone);
  const desde = params.desde ?? mes.desde;
  const hasta = params.hasta ?? mes.hasta;

  const [filas, { fondos: listaFondos }] = await Promise.all([
    libro(ctx, { desde, hasta, fondoId: params.fondo }),
    opciones(ctx),
  ]);

  return (
    <>
      <CabeceraPanel
        titulo="Libro de movimientos"
        subtitulo={
          filas.length === 0
            ? 'Nada apuntado en este periodo'
            : `${filas.length} ${filas.length === 1 ? 'movimiento' : 'movimientos'}`
        }
      >
        <Button
          render={<Link href="/panel/finanzas/movimientos/nuevo" />}
          className="flex-none"
        >
          <Plus strokeWidth={1.9} />
          Apuntar
        </Button>
      </CabeceraPanel>

      <Contenedor>
        {params.error && <Aviso>{params.error}</Aviso>}

        {/* Los filtros van en la URL para que el enlace se pueda compartir y
            para que volver atrás no los pierda. Nada de datos personales aquí:
            la query string acaba en los logs del proxy. */}
        <form
          method="get"
          className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4"
        >
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
            Desde
            <input
              type="date"
              name="desde"
              defaultValue={desde}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[14px] text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
            Hasta
            <input
              type="date"
              name="hasta"
              defaultValue={hasta}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[14px] text-foreground"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px] font-medium text-muted-foreground">
            Fondo
            <select
              name="fondo"
              defaultValue={params.fondo ?? ''}
              className="h-9 rounded-lg border border-border bg-background px-2.5 text-[14px] text-foreground"
            >
              <option value="">Todos</option>
              {listaFondos.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nombre}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" variant="outline" className="h-9">
            Filtrar
          </Button>
          <a
            href={`/panel/finanzas/exportar?desde=${desde}&hasta=${hasta}${params.fondo ? `&fondo=${params.fondo}` : ''}`}
            className="flex h-9 items-center rounded-lg border border-border bg-surface-alt px-3 text-[13.5px] font-semibold text-foreground no-underline hover:bg-background hover:no-underline"
          >
            Descargar CSV
          </a>
        </form>

        {filas.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-8 text-center text-[14px] text-muted-foreground">
            No hay movimientos en este periodo.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <Th>Fecha</Th>
                  <Th>Concepto</Th>
                  <Th>Fondo</Th>
                  <Th>Caja</Th>
                  <Th alineado="derecha">Importe</Th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-b-0">
                    <Td>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {formatearFechaLarga(m.fecha)}
                      </span>
                    </Td>
                    <Td>
                      <Link
                        href={`/panel/finanzas/movimientos/${m.id}`}
                        className="font-medium text-foreground"
                      >
                        {m.concepto}
                      </Link>
                      {m.tipoIngreso && (
                        <span className="ml-2 text-[12px] capitalize text-muted-foreground">
                          {m.tipoIngreso}
                        </span>
                      )}
                    </Td>
                    <Td>{m.fondoNombre ?? '—'}</Td>
                    <Td>{m.cajaNombre ?? '—'}</Td>
                    <Td alineado="derecha">
                      {/* El signo va en el texto, no solo en el color: la regla
                          del sistema de diseño es que un dato no se distingue
                          únicamente por color. */}
                      <span className="whitespace-nowrap font-semibold tabular-nums">
                        {formatearDineroConSigno(m.importeConSigno, moneda)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Contenedor>
    </>
  );
}

function Th({
  children,
  alineado,
}: {
  children: React.ReactNode;
  alineado?: 'derecha';
}) {
  return (
    <th
      className={`px-4 py-2.5 text-[12.5px] font-semibold uppercase tracking-wide text-muted-foreground ${alineado === 'derecha' ? 'text-right' : ''}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  alineado,
}: {
  children: React.ReactNode;
  alineado?: 'derecha';
}) {
  return (
    <td
      className={`px-4 py-3 text-[14px] ${alineado === 'derecha' ? 'text-right' : ''}`}
    >
      {children}
    </td>
  );
}
