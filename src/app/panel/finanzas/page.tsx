import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowDownLeft, ArrowUpRight, Plus, Wallet } from 'lucide-react';

import { requireIglesia } from '@/lib/auth/guard-panel';
import { esPastor } from '@/lib/auth/permisos';
import {
  estaActivado,
  resumen,
  saldosPorCaja,
  saldosPorFondo,
} from '@/lib/finanzas/consultas';
import { mesEnLaIglesia } from '@/lib/fecha/hoy';
import { formatearDinero, formatearDineroConSigno } from '@/lib/format/dinero';
import type { Moneda } from '@/lib/db/schema';
import { Aviso } from '@/components/aviso';
import { Button } from '@/components/ui/button';
import { activarFinanzas } from './actions';

export const metadata: Metadata = { title: 'Finanzas' };

export default async function FinanzasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; mes?: string }>;
}) {
  const ctx = await requireIglesia();
  const { error, mes } = await searchParams;
  const moneda = ctx.iglesia.moneda as Moneda;

  if (!(await estaActivado(ctx))) {
    return <SinActivar error={error} />;
  }

  const { desde, hasta, etiqueta } = mesEnLaIglesia(ctx.iglesia.timezone, mes);

  const [delMes, porFondo, porCaja] = await Promise.all([
    resumen(ctx, desde, hasta, etiqueta),
    saldosPorFondo(ctx),
    saldosPorCaja(ctx),
  ]);

  return (
    <>
      <header className="flex flex-col gap-4 border-b border-border bg-surface px-5 py-4 md:flex-row md:items-center md:gap-6 md:px-8">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
            Finanzas
          </h1>
          {/* `first-letter:uppercase` y no `capitalize`: Tailwind capitaliza
              CADA palabra, y `toLocaleDateString` en español devuelve «agosto de
              2026», que salía como «Agosto De 2026». */}
          <p className="text-[13px] text-muted-foreground first-letter:uppercase">
            {etiqueta}
          </p>
        </div>

        <Button
          render={<Link href="/panel/finanzas/movimientos/nuevo" />}
          className="flex-none"
        >
          <Plus strokeWidth={1.9} />
          Apuntar movimiento
        </Button>
      </header>

      <div className="flex w-full max-w-[1400px] flex-1 flex-col gap-5 px-5 pb-10 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}

        {/* Lo primero y sin filtros. Es el número por el que se abre esta
            pantalla, y si hay que buscarlo no se abre una segunda vez. */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Tarjeta
            titulo="Entró este mes"
            valor={formatearDinero(delMes.entro, moneda)}
            Icono={ArrowDownLeft}
          />
          <Tarjeta
            titulo="Salió este mes"
            valor={formatearDinero(delMes.salio, moneda)}
            Icono={ArrowUpRight}
          />
          <Tarjeta
            titulo="Diferencia"
            valor={formatearDineroConSigno(delMes.neto, moneda)}
            Icono={Wallet}
          />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <Bloque
            titulo="Saldo por fondo"
            explicacion="De quién es el dinero. Un fondo designado no se puede gastar en otra cosa."
            filas={porFondo}
            moneda={moneda}
          />
          <Bloque
            titulo="Saldo por caja"
            explicacion="Dónde está el dinero ahora mismo."
            filas={porCaja}
            moneda={moneda}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            render={<Link href="/panel/finanzas/movimientos" />}
          >
            Ver el libro
          </Button>
          <Button
            variant="outline"
            render={
              <a href={`/panel/finanzas/exportar?desde=${desde}&hasta=${hasta}`} />
            }
          >
            Descargar CSV del mes
          </Button>
          <Button
            variant="outline"
            render={<Link href={`/panel/finanzas/informe?mes=${desde.slice(0, 7)}`} />}
          >
            Informe del mes
          </Button>
          {/* Solo al pastor: crear un fondo es gobierno, y el sub-layout de
              ajustes rebota a quien no lo sea. Enseñar el enlace igualmente
              sería una sección que al pulsarla dice «no tienes acceso». */}
          {esPastor(ctx) && (
            <Button
              variant="ghost"
              render={<Link href="/panel/finanzas/ajustes" />}
            >
              Fondos y cajas
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function Tarjeta({
  titulo,
  valor,
  Icono,
}: {
  titulo: string;
  valor: string;
  Icono: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-border bg-surface p-4">
      <span className="flex items-center gap-2 text-[13px] font-medium text-muted-foreground">
        <Icono className="size-[15px]" strokeWidth={1.8} />
        {titulo}
      </span>
      <span className="text-[24px] font-bold tracking-[-0.02em] tabular-nums">
        {valor}
      </span>
    </div>
  );
}

function Bloque({
  titulo,
  explicacion,
  filas,
  moneda,
}: {
  titulo: string;
  explicacion: string;
  filas: { id: string; nombre: string; saldo: string }[];
  moneda: Moneda;
}) {
  return (
    <section className="flex flex-col rounded-xl border border-border bg-surface">
      <div className="flex flex-col gap-0.5 border-b border-border px-4 py-3">
        <h2 className="text-[15px] font-bold tracking-[-0.015em]">{titulo}</h2>
        <p className="text-[12.5px] text-muted-foreground">{explicacion}</p>
      </div>
      <ul className="flex flex-col">
        {filas.length === 0 ? (
          <li className="px-4 py-3 text-[13.5px] text-muted-foreground">
            Todavía no hay ninguno.
          </li>
        ) : (
          filas.map((f) => (
            <li
              key={f.id}
              className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 last:border-b-0"
            >
              <span className="truncate text-[14px] font-medium">{f.nombre}</span>
              <span className="flex-none text-[14px] font-semibold tabular-nums">
                {formatearDinero(f.saldo, moneda)}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}

/**
 * Sin fondo ni caja, el formulario de alta no se puede enviar: los dos campos
 * son obligatorios en la base. Así que la primera pantalla es esta y no un
 * formulario que rebota sin decir por qué.
 */
function SinActivar({ error }: { error?: string }) {
  return (
    <>
      <header className="border-b border-border bg-surface px-5 py-4 md:px-8">
        <h1 className="text-[22px] font-bold leading-tight tracking-[-0.025em]">
          Finanzas
        </h1>
      </header>

      <div className="flex w-full max-w-[640px] flex-1 flex-col gap-5 px-5 pb-10 pt-6 md:px-8">
        {error && <Aviso>{error}</Aviso>}

        <div className="flex flex-col items-start gap-3 rounded-xl border border-border bg-surface p-6">
          <Wallet className="size-7 text-muted-foreground" strokeWidth={1.5} />
          <h2 className="text-[18px] font-bold tracking-[-0.02em]">
            Lleva las cuentas de tu iglesia
          </h2>
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            Apunta la ofrenda de cada culto, los diezmos y los gastos. El saldo
            de cada fondo se calcula solo y puedes descargarlo para tu contador.
          </p>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            Se guardan totales, no personas: Hatril no registra quién dio cuánto.
          </p>
          <form action={activarFinanzas}>
            <Button type="submit">Empezar</Button>
          </form>
          <p className="text-[12.5px] text-muted-foreground">
            Se crea un fondo «General» y una caja «Efectivo». Podrás añadir más.
          </p>
        </div>
      </div>
    </>
  );
}
