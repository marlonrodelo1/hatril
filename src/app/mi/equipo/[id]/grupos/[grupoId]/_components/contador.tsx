'use client';

import { useState } from 'react';
import { Minus, Plus } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Un número que se cambia con el pulgar: menos, la cifra y más.
 *
 * Es lo que hace que el reporte sea un toque: viene con la cifra de la semana
 * pasada, y lo normal es tocar una o dos veces o ninguna. El campo sigue siendo
 * un `<input type="number">` de verdad —se puede escribir, y el formulario
 * funciona igual sin JavaScript—, a 16 px para que Safari no amplíe la página.
 */
export function Contador({
  nombre,
  etiqueta,
  inicial,
  max,
  ayuda,
}: {
  nombre: string;
  etiqueta: string;
  inicial: number;
  max: number;
  ayuda?: string;
}) {
  const [valor, setValor] = useState(String(inicial));
  const n = Number.parseInt(valor, 10);
  const actual = Number.isFinite(n) ? n : 0;
  const poner = (v: number) => setValor(String(Math.min(max, Math.max(0, v))));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={nombre} className="text-label font-semibold">
        {etiqueta}
      </label>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => poner(actual - 1)}
          disabled={actual <= 0}
          aria-label={`Uno menos en ${etiqueta.toLocaleLowerCase('es')}`}
        >
          <Minus strokeWidth={1.8} />
        </Button>
        <input
          id={nombre}
          name={nombre}
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          required
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          className="h-10 w-20 rounded-lg border border-input bg-surface-alt px-2 text-center text-[16px] font-semibold tabular-nums outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/16"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => poner(actual + 1)}
          disabled={actual >= max}
          aria-label={`Uno más en ${etiqueta.toLocaleLowerCase('es')}`}
        >
          <Plus strokeWidth={1.8} />
        </Button>
      </div>
      {ayuda && <p className="t-label text-muted-foreground">{ayuda}</p>}
    </div>
  );
}
