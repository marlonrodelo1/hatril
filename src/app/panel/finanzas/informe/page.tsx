import type { Metadata } from 'next';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { libro, resumen, saldosPorFondo } from '@/lib/finanzas/consultas';
import { mesEnLaIglesia } from '@/lib/fecha/hoy';
import { formatearDinero } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { BotonImprimir } from './_components/boton-imprimir';

export const metadata: Metadata = {
  title: 'Informe del mes',
  // Un informe con las cuentas de una congregación no lo indexa nadie, aunque
  // el guard ya lo proteja: cinturón y tirantes.
  robots: { index: false, follow: false },
};

/**
 * El informe del mes para la asamblea, en una página imprimible.
 *
 * SIN DEPENDENCIA DE PDF, Y NO ES UNA CARENCIA
 * --------------------------------------------
 * «Imprimir → Guardar como PDF» está en todos los navegadores y en el móvil.
 * Generar el PDF en el servidor costaba Chromium en la imagen de Docker —unos
 * 300 MB en un VPS compartido por todas las iglesias— o una librería que hay que
 * mantener, y para 3.000 filas bloquearía el proceso de Node durante segundos,
 * tumbando el panel de todas las demás congregaciones a la vez.
 *
 * En muchas iglesias pequeñas esta hoja es la única rendición de cuentas del
 * año, así que está escrita para que la entienda alguien que no sabe
 * contabilidad: entradas, salidas, diferencia, y de quién es lo que queda.
 */
export default async function InformePage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const ctx = await requireIglesia();
  const { mes } = await searchParams;
  const moneda = ctx.iglesia.moneda as Moneda;

  const { desde, hasta, etiqueta } = mesEnLaIglesia(ctx.iglesia.timezone, mes);

  const [delMes, porFondo, filas] = await Promise.all([
    resumen(ctx, desde, hasta, etiqueta),
    saldosPorFondo(ctx),
    libro(ctx, { desde, hasta }, 500),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 px-5 py-8 md:px-8 print:max-w-none print:px-0 print:py-0">
      {/* `print:hidden`: el botón no sale en el papel. */}
      <div className="flex items-center justify-between gap-4 print:hidden">
        <p className="text-[13px] text-muted-foreground">
          Usa «Imprimir» y elige «Guardar como PDF» si lo quieres en fichero.
        </p>
        <BotonImprimir />
      </div>

      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-[24px] font-bold tracking-[-0.025em]">
          {ctx.iglesia.nombre}
        </h1>
        <p className="text-[15px] text-muted-foreground first-letter:uppercase">
          Informe de {etiqueta}
        </p>
      </header>

      {/* Una columna en móvil. Estaba fijo a `grid-cols-3` y las tres cifras no
          caben en 375 px: el contenido mínimo de las celdas empujaba el ancho y
          la página entera scrolleaba en horizontal, informe incluido.
          `print:grid-cols-3` porque en papel siempre van las tres en fila, sin
          depender de que la hoja mida más que el punto de corte `sm`. */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3 print:grid-cols-3">
        <Cifra titulo="Entró" valor={formatearDinero(delMes.entro, moneda)} />
        <Cifra titulo="Salió" valor={formatearDinero(delMes.salio, moneda)} />
        <Cifra
          titulo="Diferencia"
          valor={formatearDinero(delMes.neto, moneda)}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold tracking-[-0.015em]">
          Qué hay en cada fondo
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          Saldo acumulado, no solo lo de este mes.
        </p>
        {/* La tabla scrollea DENTRO de su caja, que es el patrón del libro de
            movimientos. Sin esto, en un móvil el desbordamiento lo absorbía la
            página y se movía el informe entero.
            `print:` lo deshace: en papel no hay scroll que valga, así que el
            ancho mínimo tiene que desaparecer o la tabla saldría cortada por el
            borde de la hoja. */}
        <div className="overflow-x-auto print:overflow-x-visible">
          <table className="w-full min-w-[560px] border-collapse print:min-w-0">
            <tbody>
              {porFondo.map((f) => (
                <tr key={f.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 text-[14px]">{f.nombre}</td>
                  <td className="py-2 text-right text-[14px] font-semibold tabular-nums">
                    {formatearDinero(f.saldo, moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold tracking-[-0.015em]">
          Detalle del mes
        </h2>
        {filas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">
            No hay movimientos en este mes.
          </p>
        ) : (
          // Mismo scroll acotado que la tabla de fondos, y por lo mismo: cinco
          // columnas no caben en un móvil, y sin caja que las contenga el que
          // se desplazaba era el informe completo.
          <div className="overflow-x-auto print:overflow-x-visible">
            <table className="w-full min-w-[560px] border-collapse print:min-w-0">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fecha
                  </th>
                  <th className="py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Concepto
                  </th>
                  <th className="py-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Fondo
                  </th>
                  <th className="py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Entró
                  </th>
                  <th className="py-2 text-right text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Salió
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.map((m) => (
                  <tr
                    key={m.id}
                    // `break-inside-avoid`: una fila no se parte por la mitad
                    // entre dos hojas de papel.
                    className="break-inside-avoid border-b border-border last:border-b-0"
                  >
                    <td className="py-2 text-[13px] tabular-nums">{m.fecha}</td>
                    <td className="py-2 text-[13px]">{m.concepto}</td>
                    <td className="py-2 text-[13px]">{m.fondoNombre ?? '—'}</td>
                    {/* Dos columnas en vez de una con signo: en papel, y para
                        alguien que no lee balances, «entró» y «salió» separados
                        se entienden sin explicación. */}
                    <td className="py-2 text-right text-[13px] tabular-nums">
                      {m.tipo === 'ingreso'
                        ? formatearDinero(m.importe, moneda)
                        : ''}
                    </td>
                    <td className="py-2 text-right text-[13px] tabular-nums">
                      {m.tipo === 'gasto'
                        ? formatearDinero(m.importe, moneda)
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {filas.length === 500 && (
          <p className="text-[12.5px] text-muted-foreground">
            Se muestran los primeros 500 movimientos. Descarga el CSV para verlos
            todos.
          </p>
        )}
      </section>

      <footer className="border-t border-border pt-4 text-[12px] text-muted-foreground">
        Hatril registra totales por fondo y por caja. No guarda quién dio cuánto.
      </footer>
    </div>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border p-4">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
        {titulo}
      </span>
      <span className="text-[20px] font-bold tracking-[-0.02em] tabular-nums">
        {valor}
      </span>
    </div>
  );
}
