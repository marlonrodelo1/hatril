import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import type { CuentasDelFondo } from '@/lib/finanzas/del-ministerio';
import { formatearFechaLarga } from '@/lib/fecha/hoy';
import { formatearDinero, formatearDineroConSigno } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { buttonVariants } from '@/components/ui/button';

/**
 * El fondo de un ministerio, de solo lectura. Lo pintan la pestaña del panel y
 * la pantalla de la app del líder, con la misma vista: el líder lo abre casi
 * siempre en el móvil, desde cualquiera de las dos puertas.
 *
 * Sin un solo botón naranja: aquí no se hace nada, se mira. Lo apunta el
 * tesorero, y la pantalla lo dice para que nadie busque dónde se añade un gasto.
 *
 * Los ingresos van en una cifra y nunca en filas (`del-ministerio.ts` cuenta
 * por qué). Los gastos sí, con su concepto, porque es lo que el líder necesita
 * para saber en qué se fue su dinero.
 */
export function CuentasDelFondoVista({
  cuentas: c,
  moneda,
  base,
  mes,
}: {
  cuentas: CuentasDelFondo;
  moneda: Moneda;
  /** La ruta de esta pantalla, en el panel o en la app: los meses cuelgan de ella. */
  base: string;
  mes: { etiqueta: string; anterior: string; siguiente: string | null };
}) {
  const nombreMes = mes.etiqueta.split(' de ')[0] ?? mes.etiqueta;

  return (
    // Ancho de lectura dentro del panel, sin cambiar el del contenedor: las
    // pestañas del ministerio no saltan al pasar a esta.
    <div className="flex w-full max-w-[760px] flex-col gap-4">
      <p className="rounded-xl border border-border bg-surface px-4 py-3 text-pretty text-label text-muted-foreground">
        Es el fondo «{c.fondo.nombre}» de la caja de la iglesia. Lo lleva el
        tesorero: si falta un gasto, dale el tique. Lo que entra se ve solo en
        total, porque en un fondo pequeño una cifra suelta diría quién la dio.
      </p>

      <section className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-5">
        <span className="t-micro">Hay en el fondo</span>
        <span className="t-cifra tabular-nums">
          {formatearDineroConSigno(c.saldo, moneda).replace(/^\+/, '')}
        </span>
      </section>

      {/* El mes, con sus vecinos. Enlaces y no un desplegable: se va de uno en
          uno, y un GET funciona en cualquier móvil. */}
      <nav
        aria-label="Mes"
        className="flex items-center justify-between gap-2"
      >
        <Link
          href={`${base}?mes=${mes.anterior}`}
          className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
          aria-label="Mes anterior"
        >
          <ChevronLeft strokeWidth={1.8} />
        </Link>
        <span className="text-body font-semibold first-letter:uppercase">
          {mes.etiqueta}
        </span>
        {mes.siguiente ? (
          <Link
            href={`${base}?mes=${mes.siguiente}`}
            className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
            aria-label="Mes siguiente"
          >
            <ChevronRight strokeWidth={1.8} />
          </Link>
        ) : (
          // El hueco, para que el nombre del mes no salte de sitio.
          <span className="size-[34px]" aria-hidden />
        )}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <Cifra rotulo={`Entró en ${nombreMes}`} valor={formatearDinero(c.entro, moneda)} />
        <Cifra rotulo={`Salió en ${nombreMes}`} valor={formatearDinero(c.salio, moneda)} />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="t-micro px-1">Lo que salió en {nombreMes}</h2>

        {c.gastos.length === 0 ? (
          <p className="rounded-xl border border-border bg-surface px-4 py-3 text-body text-muted-foreground">
            No salió nada de este fondo en {nombreMes}.
          </p>
        ) : (
          <ul className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
            {c.gastos.map((g) => (
              <li
                key={g.id}
                className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 md:px-5"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-pretty text-body font-semibold">
                    {g.concepto}
                  </span>
                  <span className="text-label text-muted-foreground first-letter:uppercase">
                    {formatearFechaLarga(g.fecha)}
                  </span>
                </span>
                <span className="flex-none text-body font-semibold tabular-nums">
                  {formatearDinero(g.importe, moneda)}
                </span>
              </li>
            ))}
          </ul>
        )}

        {c.totalGastos > c.gastos.length && (
          <p className="px-1 text-label text-muted-foreground">
            Salen los {c.gastos.length} más recientes de los {c.totalGastos} del
            mes. El resto lo tiene el tesorero en el libro.
          </p>
        )}
      </section>
    </div>
  );
}

function Cifra({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-border bg-surface p-4">
      <span className="t-micro truncate">{rotulo}</span>
      <span className="t-subtitulo truncate tabular-nums">{valor}</span>
    </div>
  );
}
