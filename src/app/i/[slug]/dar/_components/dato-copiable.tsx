'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, CircleAlert, Copy } from 'lucide-react';
import { clsx } from 'clsx';

import { Button } from '@/components/ui/button';

/**
 * La cuenta o el titular, con su botón de copiar.
 *
 * Lo que se hace con una cuenta es pegarla en la app del banco, y seleccionar
 * un IBAN a mano en un móvil es donde la gente se rinde. Es la misma pieza que
 * `Copiable` de la ficha del super admin, escrita aquí y no importada de allí:
 * esta es una página pública y no debe romperse porque cambie una pantalla de
 * administración.
 *
 * El valor va entero, partido donde haga falta (`break-all`) y no cortado con
 * puntos suspensivos: una cuenta cortada no sirve para nada.
 */
export function DatoCopiable({
  etiqueta,
  valor,
  que,
}: {
  etiqueta: string;
  valor: string;
  /** «la cuenta», «el titular»: para el botón y para lo que se anuncia. */
  que: string;
}) {
  const [estado, setEstado] = useState<'copiado' | 'fallo' | null>(null);
  const texto = useRef<HTMLSpanElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    },
    [],
  );

  function marcar(nuevo: 'copiado' | 'fallo') {
    setEstado(nuevo);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setEstado(null), 1800);
  }

  /** Sin portapapeles (contexto no seguro, un WebView capado): queda seleccionado. */
  function seleccionar() {
    const el = texto.current;
    if (el) window.getSelection()?.selectAllChildren(el);
    marcar('fallo');
  }

  function copiar() {
    // `writeText` dentro del mismo clic, sin nada esperado antes: fuera de un
    // gesto de la persona el navegador lo rechaza.
    let escribir: Promise<void> | undefined;
    try {
      escribir = navigator.clipboard?.writeText(valor);
    } catch {
      escribir = undefined;
    }
    if (!escribir) {
      seleccionar();
      return;
    }
    escribir.then(() => marcar('copiado'), seleccionar);
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-label text-muted-foreground">{etiqueta}</span>
        {/* `tabular-nums`: un número de cuenta con cifras que bailan es más
            fácil de copiar mal. */}
        <span
          ref={texto}
          className="text-body font-semibold tabular-nums break-all select-all"
        >
          {valor}
        </span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        onClick={copiar}
        aria-label={`Copiar ${que}`}
        className={clsx(
          'flex-none',
          estado === 'copiado' &&
            'border-transparent bg-badge-success-bg text-badge-success-fg hover:bg-badge-success-bg',
          estado === 'fallo' && 'text-danger',
        )}
      >
        {estado === 'copiado' ? (
          <Check className="anim-aparece size-4" strokeWidth={1.8} />
        ) : estado === 'fallo' ? (
          <CircleAlert className="anim-aparece size-4" strokeWidth={1.8} />
        ) : (
          <Copy className="size-4" strokeWidth={1.8} />
        )}
      </Button>
      <span role="status" className="sr-only">
        {estado === 'copiado'
          ? `Se ha copiado ${que}`
          : estado === 'fallo'
            ? `No se ha podido copiar ${que}. Está seleccionado: cópialo con el teclado.`
            : ''}
      </span>
    </div>
  );
}
