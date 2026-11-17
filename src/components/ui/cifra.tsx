import type { ReactNode } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';

import { CuentaQueSube } from '@/components/ui/cuenta-que-sube';

/**
 * Una cifra: su rótulo, el número en carbón, lo que ha cambiado y, si toca,
 * una barra.
 *
 * NUNCA EN NARANJA
 * ----------------
 * El naranja es para acciones (regla 6). «La caja» de Inicio pintaba las
 * cifras en naranja porque iban dentro de un enlace que no llevaba
 * `text-foreground` (inventario, M6). Aquí el número es `text-foreground`
 * aunque la cifra entera sea un enlace.
 *
 * Si `valor` es un número, sube desde cero la primera vez que se ve; si es un
 * texto ya formateado (una cantidad con su moneda), se pinta tal cual.
 */
export function Cifra({
  etiqueta,
  valor,
  unidad,
  miles = false,
  cambio,
  medidor,
  className,
  children,
}: {
  etiqueta: string;
  valor: number | string;
  /** Lo que va junto al número, más pequeño: «COP», «%». */
  unidad?: string;
  miles?: boolean;
  /** Lo que ha cambiado: «+6 este mes». `sube: false` lo pinta en gris. */
  cambio?: { texto: string; sube?: boolean };
  /** De 0 a 100: la barra de debajo. */
  medidor?: number;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-4',
        className,
      )}
    >
      <span className="t-micro">{etiqueta}</span>
      <span className="flex items-baseline gap-1.5 text-foreground">
        <span className="t-cifra tabular-nums">
          {typeof valor === 'number' ? (
            <CuentaQueSube valor={valor} miles={miles} />
          ) : (
            valor
          )}
        </span>
        {unidad && (
          <span className="text-label font-semibold text-muted-foreground">
            {unidad}
          </span>
        )}
      </span>
      {cambio && (
        <span
          className={clsx(
            'inline-flex h-[22px] w-max items-center gap-1 rounded-full px-2 text-[12px] font-semibold',
            cambio.sube === false
              ? 'bg-badge-neutral-bg text-badge-neutral-fg'
              : 'bg-badge-success-bg text-badge-success-fg',
          )}
        >
          {cambio.sube === false ? (
            <TrendingDown className="size-[13px]" strokeWidth={2} aria-hidden />
          ) : (
            <TrendingUp className="size-[13px]" strokeWidth={2} aria-hidden />
          )}
          {cambio.texto}
        </span>
      )}
      {medidor !== undefined && (
        <span className="h-1.5 overflow-hidden rounded-full bg-surface-active" aria-hidden>
          <span
            className="block h-full rounded-full bg-support"
            style={{ width: `${Math.max(0, Math.min(100, medidor))}%` }}
          />
        </span>
      )}
      {children}
    </div>
  );
}
