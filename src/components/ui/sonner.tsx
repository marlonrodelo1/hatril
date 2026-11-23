'use client';

import { Toaster as Sonner, type ToasterProps } from 'sonner';
import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';

/**
 * Los avisos que llegan y se van solos (Sonner).
 *
 * BASE COMÚN (17-nov)
 * -------------------
 * Carbón con letra blanca, abajo y centrados, sin sombra y con borde: la
 * pieza de avisos que aprobó Marlon. Se van solos a los 5 s y se apilan tres
 * como mucho.
 *
 * SIGUE SIN MONTARSE, A PROPÓSITO
 * Ninguna pantalla llama todavía a `toast()`: las server actions redirigen con
 * `?ok=1` y la pantalla de llegada pinta su `<Aviso>`. Montarlo en el layout
 * raíz sería cargar Sonner en todas las páginas para nada. El día que una
 * acción en línea lo necesite, se monta ahí y ya está listo.
 *
 * Sin `next-themes`: Hatril tiene un solo modo, el claro, y el `useTheme` que
 * traía shadcn de fábrica pedía un proveedor que no existe. Era lo que impedía
 * montarlo (ver `copiar.tsx`).
 */
export function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="bottom-center"
      duration={5000}
      visibleToasts={3}
      className="toaster group"
      icons={{
        success: <CircleCheck className="size-[18px]" strokeWidth={1.9} />,
        info: <Info className="size-[18px]" strokeWidth={1.9} />,
        warning: <TriangleAlert className="size-[18px]" strokeWidth={1.9} />,
        error: <CircleAlert className="size-[18px]" strokeWidth={1.9} />,
        loading: (
          <LoaderCircle
            className="size-[18px] animate-spin motion-reduce:animate-none"
            strokeWidth={1.9}
          />
        ),
      }}
      style={
        {
          '--normal-bg': 'var(--secondary)',
          '--normal-text': 'var(--secondary-foreground)',
          '--normal-border': 'var(--secondary)',
          '--border-radius': '10px',
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: '!shadow-none font-sans text-[14px]',
        },
      }}
      {...props}
    />
  );
}
