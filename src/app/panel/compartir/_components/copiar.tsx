'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { Button } from '@/components/ui/button';

/**
 * Una dirección, visible y copiable.
 *
 * POR QUÉ NO SE USA `toast`
 * -------------------------
 * `src/lib/toast.ts` existe y `src/components/ui/sonner.tsx` también, pero
 * **el `<Toaster />` no está montado en ningún layout del producto**: una
 * llamada a `toast()` no pintaría nada y el fallo sería silencioso. Montarlo
 * traería `next-themes` a una aplicación que es de modo claro únicamente. El
 * propio botón diciendo «Copiado» resuelve lo mismo y no depende de nada.
 *
 * POR QUÉ ADEMÁS SE PINTA LA URL EN UN INPUT
 * ------------------------------------------
 * `navigator.clipboard` no existe fuera de contextos seguros y hay navegadores
 * de móvil que lo bloquean dentro de un WebView. Con la dirección delante,
 * seleccionarla a mano siempre funciona; sin ella, quien tenga el portapapeles
 * capado se queda mirando un botón que no hace nada.
 */
export function Copiar({
  url,
  etiqueta,
  destacado = false,
}: {
  url: string;
  /** Para el lector de pantalla: «Copiar la dirección de tu página». */
  etiqueta: string;
  destacado?: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sin esto, copiar y navegar a otra pantalla antes de los dos segundos deja
  // un setState apuntando a un componente que ya no existe.
  useEffect(() => {
    return () => {
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, []);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Portapapeles bloqueado: se deja seleccionada para que baste con Ctrl+C.
      campo.current?.select();
      return;
    }
    setCopiado(true);
    if (temporizador.current) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => setCopiado(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <input
        ref={campo}
        readOnly
        value={url}
        aria-label={etiqueta}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-input bg-surface-alt px-3 py-2.5 text-[14px] text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-primary/16"
      />
      <Button
        type="button"
        onClick={copiar}
        variant={destacado ? 'default' : 'outline'}
        className="flex-none"
        // `aria-live` para que el lector de pantalla anuncie el cambio: sin
        // esto, quien no ve el botón no se entera de que ha copiado.
        aria-live="polite"
      >
        {copiado ? (
          <>
            <Check strokeWidth={2} />
            Copiado
          </>
        ) : (
          <>
            <Copy strokeWidth={1.8} />
            Copiar
          </>
        )}
      </Button>
    </div>
  );
}
